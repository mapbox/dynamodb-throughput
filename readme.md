# dynamodb-throughput

[![Build Status](https://travis-ci.org/mapbox/dynamodb-throughput.svg?branch=master)](https://travis-ci.org/mapbox/dynamodb-throughput)

Set and reset provisioned DynamoDB throughput

## Usage

### Adjusting capacities

You can set the table's read and write capacities to perform some operation that requires a lot of throughput. After you're done, you can reset the provisioned throughput to prior levels. If you change throughput multiple times, reseting will return to the original table values, before dynamodb-throughtput made any adjustments.

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
var queue = require('queue-async');

queue(1)
  .defer(throughput.setCapacity, { read: 1000, write: 1000 })
  .defer(doSomethingStrenuous)
  .defer(throughput.resetCapacity)
  .awaitAll(function(err) {
    console.log(err || 'All done!');
  });
```

It also works on GlobalSecondaryIndexes.

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
var queue = require('queue-async');

queue(1)
  .defer(throughput.setIndexCapacity, 'my-index', { read: 1000, write: 1000 })
  .defer(doSomethingStrenuous)
  .defer(throughput.resetIndexCapacity, 'my-index')
  .awaitAll(function(err) {
    console.log(err || 'All done!');
  });
```

If you prefer, you can make adjustments to the table's existing throughput. For example, if you wanted to add 500 to the table's existing read capacity:

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
var queue = require('queue-async');

queue(1)
  .defer(throughput.adjustCapacity, { read: 500 })
  .defer(doSomethingStrenuous)
  .defer(throughput.resetCapacity)
  .awaitAll(function(err) {
    console.log(err || 'All done!');
  });
```

... and similarly for GlobalSecondaryIndexes:

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
var queue = require('queue-async');

queue(1)
  .defer(throughput.setIndexCapacity, 'my-index', { read: 500 })
  .defer(doSomethingStrenuous)
  .defer(throughput.resetIndexCapacity, 'my-index')
  .awaitAll(function(err) {
    console.log(err || 'All done!');
  });
```

The second argument when creating the throughput object (`{ region: 'us-east-1' }` in these examples) is an options object passed to [`new AWS.DynamoDB(options)`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property) to communicate with DynamoDB. Usually you should only need to provide a `region` property.

### Getting throughput / partitioning information

You can use this library to gather information about a table's current throughput and estimate its partitioning needs. See [the AWS DynamoDB documentation](http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GuidelinesForTables.html#GuidelinesForTables.Partitions) for more information about the way a table's partitioning needs are calculated.

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
throughput.tableInfo(function(err, info) {
  console.log(info);
  // {
  //   main: {
  //     read: 4000,
  //     write: 300,
  //     size: 67432123,
  //     partitions: 2
  //   },
  //   indexes: {
  //     indexName: {
  //       read: 300,
  //       write: 100,
  //       size: 873624,
  //       partitions: 1
  //     }
  //   }
  // }
});
```

Increasing throughput can require your table to be repartitioned, and this can have unexpected consequences on the throughput performance of your table. This library can estimate the partitioning that would be required by a proposed throughput adjustment. Running this function has no impact on your table, it simply provides you with information about your table's state if you were to perform such an adjustment.

```js
var throughput = require('dynamodb-throughput')('my-table', { region: 'us-east-1' });
var adjustment = { main: { read: 13000 } } // increases table's read capacity to 13000
throughput.adjustedTableInfo(adjustment, function(err, info, warnings) {
  console.log(info);
  // {
  //   main: {
  //     read: 13000,
  //     write: 300,
  //     size: 67432123,
  //     partitions: 5
  //   },
  //   indexes: {
  //     indexName: {
  //       read: 300,
  //       write: 100,
  //       size: 873624,
  //       partitions: 1
  //     }
  //   }
  // }
  console.log(warnings);
  // {
  //   main: true,
  //   indexes: {}
  // }
});
```

Included shell scripts can be used to run either of these functions.

```sh
$ npm install -g dynamodb-throughput
$ dynamodb-throughput-info us-east-1/my-table
# {
#   main: {
#     read: 4000,
#     write: 300,
#     size: 67432123,
#     partitions: 2
#   },
#   indexes: {
#     indexName: {
#       read: 300,
#       write: 100,
#       size: 873624,
#       partitions: 1
#     }
#   }
# }
$ dynamodb-throughput-adjustment us-east-1/my-table --main-read 13000
# WARNING: This adjustment would force the table to be repartitioned
# {
#   main: {
#     read: 13000,
#     write: 300,
#     size: 67432123,
#     partitions: 5
#   },
#   indexes: {
#     indexName: {
#       read: 300,
#       write: 100,
#       size: 873624,
#       partitions: 1
#     }
#   }
# }
```
