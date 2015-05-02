var AWS = require('aws-sdk');

module.exports = function(tableName, dynamoOptions) {
  var cache = {
    main: {},
    indexes: {}
  };

  function updateTable(update, callback) {
    var dynamo = new AWS.DynamoDB(dynamoOptions);
    dynamo.updateTable(update, function(err) {
      if (err && err.code === 'ValidationException' && /The requested value equals the current value/.test(err.message))
        return callback();
      if (err) return callback(err);
      setTimeout(check, 1000);
    });

    function check() {
      dynamo.describeTable({TableName: tableName}, function(err, data) {
        if (err) return callback(err);
        var gsis = data.Table.GlobalSecondaryIndexes || [];
        var active = gsis.reduce(function(active, index) {
          if (index.IndexStatus !== 'ACTIVE') active = false;
          return active;
        }, data.Table.TableStatus === 'ACTIVE');
        if (active) return callback();
        setTimeout(check, 1000);
      });
    }
  }

  function describeTable(callback) {
    var dynamo = new AWS.DynamoDB(dynamoOptions);
    dynamo.describeTable({ TableName: tableName }, function(err, data) {
      if (err) return callback(err);

      var main = {
        read: data.Table.ProvisionedThroughput.ReadCapacityUnits,
        write: data.Table.ProvisionedThroughput.WriteCapacityUnits
      };

      var gsis = data.Table.GlobalSecondaryIndexes || [];
      var indexes = gsis.reduce(function(indexes, index) {
        indexes[index.IndexName] = {
          read: index.ProvisionedThroughput.ReadCapacityUnits,
          write: index.ProvisionedThroughput.WriteCapacityUnits
        };

        return indexes;
      }, {});
      callback(null, main, indexes);
    });
  }

  var throughput = {
    setCapacity: function(capacity, callback) {
      if (cache.main.read && cache.main.write) return update();

      describeTable(function(err, main) {
        if (err) return callback(err);

        cache.main.read = main.read;
        cache.main.write = main.write;

        update();
      });

      function update() {
        var params = {
          TableName: tableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: capacity.read || cache.main.read,
            WriteCapacityUnits: capacity.write || cache.main.write
          }
        };
        updateTable(params, callback);
      }
    },

    adjustCapacity: function(adjustment, callback) {
      describeTable(function(err, main) {
        var capacity = {
          read: main.read + adjustment.read,
          write: main.write + adjustment.write
        };

        throughput.setCapacity(capacity, callback);
      });
    },

    setIndexCapacity: function(indexName, capacity, callback) {
      var index = cache.indexes[indexName];
      if (!index) index = cache.indexes[indexName] = {};
      if (index.read && index.write) return update();

      describeTable(function(err, main, indexes) {
        if (err) return callback(err);

        if (!(indexName in indexes))
          return callback(new Error('Invalid indexName: ' + indexName));

        index.read = indexes[indexName].read;
        index.write = indexes[indexName].write;

        update();
      });

      function update() {
        var params = {
          TableName: tableName,
          GlobalSecondaryIndexUpdates: [
            {
              Update: {
                IndexName: indexName,
                ProvisionedThroughput: {
                  ReadCapacityUnits: capacity.read || index.read,
                  WriteCapacityUnits: capacity.write || index.write
                }
              }
            }
          ]
        };
        updateTable(params, callback);
      }
    },

    adjustIndexCapacity: function(indexName, adjustment, callback) {
      describeTable(function(err, main, indexes) {
        if (err) return callback(err);
        if (!(indexName in indexes))
          return callback(new Error('Invalid indexName: ' + indexName));

        var capacity = {
          read: indexes[indexName].read + adjustment.read,
          write: indexes[indexName].write + adjustment.write
        };

        throughput.setIndexCapacity(indexName, capacity, callback);
      });
    },

    resetCapacity: function(callback) {
      if (!cache.main.read) return callback();

      var update = {
        TableName: tableName,
        ProvisionedThroughput: {
          ReadCapacityUnits: cache.main.read,
          WriteCapacityUnits: cache.main.write
        }
      };
      updateTable(update, callback);
    },

    resetIndexCapacity: function(indexName, callback) {
      if (!cache.indexes[indexName] || !cache.indexes[indexName].read) return callback();

      var update = {
        TableName: tableName,
        GlobalSecondaryIndexUpdates: [
          {
            Update: {
              IndexName: indexName,
              ProvisionedThroughput: {
                ReadCapacityUnits: cache.indexes[indexName].read,
                WriteCapacityUnits: cache.indexes[indexName].write
              }
            }
          }
        ]
      };
      updateTable(update, callback);
    }
  };

  return throughput;
};
