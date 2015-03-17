var AWS = require('aws-sdk');

module.exports = function(tableName, region) {
  var cache = {
    main: {},
    indexes: {}
  };

  function updateTable(update, callback) {
    var dynamo = new AWS.DynamoDB({ region: region });
    dynamo.updateTable(update, function(err) {
      if (err) return callback(err);
      setTimeout(check, 1000);
    });

    function check() {
      dynamo.describeTable({TableName: tableName}, function(err, data) {
        if (err) return callback(err);
        var active = data.Table.GlobalSecondaryIndexes.reduce(function(active, index) {
          if (index.IndexStatus !== 'ACTIVE') active = false;
          return active;
        }, data.Table.TableStatus === 'ACTIVE');
        if (active) return callback();
        setTimeout(check, 1000);
      });
    }
  }

  function describeTable(callback) {
    var dynamo = new AWS.DynamoDB({ region: region });
    dynamo.describeTable({ TableName: tableName }, function(err, data) {
      if (err) return callback(err);

      var main = {
        read: data.Table.ProvisionedThroughput.ReadCapacityUnits,
        write: data.Table.ProvisionedThroughput.WriteCapacityUnits
      };

      var indexes = data.Table.GlobalSecondaryIndexes.reduce(function(indexes, index) {
        indexes[index.IndexName] = {
          read: index.ProvisionedThroughput.ReadCapacityUnits,
          write: index.ProvisionedThroughput.WriteCapacityUnits
        };

        return indexes;
      }, {});
      callback(null, main, indexes);
    });
  }

  return {
    setCapacity: function(capacity, callback) {
      describeTable(function(err, main) {
        cache.main.read = main.read;
        cache.main.write = main.write;

        var update = {
          TableName: tableName,
          ProvisionedThroughput: {
            ReadCapacityUnits: capacity.read || main.read,
            WriteCapacityUnits: capacity.write || main.write
          }
        };
        updateTable(update, callback);
      });
    },

    setIndexCapacity: function(indexName, capacity, callback) {
      describeTable(function(err, main, indexes) {
        if (!(indexName in indexes))
          return callback(new Error('Invalid indexName: ' + indexName));

        var index = cache.indexes[indexName];
        if (!index) index = cache.indexes[indexName] = {};

        index.read = indexes[indexName].read;
        index.write = indexes[indexName].write;

        var update = {
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
        updateTable(update, callback);
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
};
