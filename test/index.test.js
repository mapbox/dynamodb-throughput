var AWS = require('aws-sdk');
var DynamoDB = AWS.DynamoDB;
var queue = require('queue-async');
var _ = require('underscore');
var crypto = require('crypto');

if (!process.env.LIVE_TEST) {
  AWS.DynamoDB = function(options) {
    options.endpoint = 'http://localhost:4567';
    options.accessKeyId = 'fake';
    options.secretAccessKey = 'fake';
    options.region = 'fake';

    _(this).extend(new DynamoDB(options));
  };
}

var testTable = {
  TableName: 'dynamodb-throughput-test-' + crypto.randomBytes(4).toString('hex'),
  AttributeDefinitions: [
    {
      AttributeName: 'id',
      AttributeType: 'S'
    },
    {
      AttributeName: 'other',
      AttributeType: 'S'
    }
  ],
  KeySchema: [
    {
      AttributeName: 'id',
      KeyType: 'HASH'
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  },
  GlobalSecondaryIndexes: [
    {
      IndexName: 'test-index',
      KeySchema: [
        {
          AttributeName: 'other',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    }
  ]
};

var tape = require('tape');
var dynamo = new AWS.DynamoDB({ region: 'us-east-1' });
var dynalite = require('dynalite')({
  createTableMs: 0,
  deleteTableMs: 0,
  updateTableMs: 2000
});

function test(name, callback) {
  tape('start dynalite', function(assert) {
    dynalite.listen(4567, function(err) {
      if (err) throw err;
      assert.end();
    });
  });
  tape('create table', function(assert) {
    dynamo.createTable(testTable, function(err) {
      if (err) throw err;
      setTimeout(check, 1000);

      function check() {
        dynamo.describeTable({TableName: testTable.TableName}, function(err, data) {
          if (err) throw err;
          var active = data.Table.GlobalSecondaryIndexes.reduce(function(active, index) {
            if (index.IndexStatus !== 'ACTIVE') active = false;
            return active;
          }, data.Table.TableStatus === 'ACTIVE');
          if (active) return assert.end();
          setTimeout(check, 1000);
        });
      }
    });
  });
  tape(name, callback);
  tape('stop dynalite', function(assert) {
    dynalite.close(function() {
      assert.end();
    });
  });
}

test('dynamodb-throughput', function(assert) {
  var throughput = require('..')(testTable.TableName, 'us-east-1');

  queue(1)
    .defer(throughput.setCapacity, { read: 100, write: 1000 })
    .defer(function(next) {
      dynamo.describeTable({
        TableName: testTable.TableName
      }, function(err, data) {
        if (err) return next(err);

        assert.equal(
          data.Table.ProvisionedThroughput.ReadCapacityUnits,
          100,
          'sets main read capacity'
        );

        assert.equal(
          data.Table.ProvisionedThroughput.WriteCapacityUnits,
          1000,
          'sets main write capacity'
        );

        next();
      });
    })
    .defer(throughput.resetCapacity)
    .defer(function(next) {
      dynamo.describeTable({
        TableName: testTable.TableName
      }, function(err, data) {
        if (err) return next(err);

        assert.equal(
          data.Table.ProvisionedThroughput.ReadCapacityUnits,
          1,
          'resets main read capacity'
        );

        assert.equal(
          data.Table.ProvisionedThroughput.WriteCapacityUnits,
          1,
          'resets main write capacity'
        );

        next();
      });
    })
    .defer(throughput.setIndexCapacity, 'test-index', { read: 100, write: 1000 })
    .defer(function(next) {
      dynamo.describeTable({
        TableName: testTable.TableName
      }, function(err, data) {
        if (err) return next(err);

        assert.equal(
          data.Table.GlobalSecondaryIndexes[0].ProvisionedThroughput.ReadCapacityUnits,
          100,
          'sets index read capacity'
        );

        assert.equal(
          data.Table.GlobalSecondaryIndexes[0].ProvisionedThroughput.WriteCapacityUnits,
          1000,
          'sets index write capacity'
        );

        next();
      });
    })
    .defer(throughput.resetIndexCapacity, 'test-index')
    .defer(function(next) {
      dynamo.describeTable({
        TableName: testTable.TableName
      }, function(err, data) {
        if (err) return next(err);

        assert.equal(
          data.Table.GlobalSecondaryIndexes[0].ProvisionedThroughput.ReadCapacityUnits,
          1,
          'resets index read capacity'
        );

        assert.equal(
          data.Table.GlobalSecondaryIndexes[0].ProvisionedThroughput.WriteCapacityUnits,
          1,
          'resets index write capacity'
        );

        next();
      });
    })
    .defer(dynamo.deleteTable.bind(dynamo), { TableName: testTable.TableName })
    .awaitAll(function(err) {
      if (err) throw err;
      assert.end();
    });
});
