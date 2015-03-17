# dynamodb-throughput

[![Build Status](https://travis-ci.org/mapbox/dynamodb-throughput.svg?branch=master)](https://travis-ci.org/mapbox/dynamodb-throughput)

Set and reset provisioned DynamoDB throughput

## Usage

You can set the table's read and write capacities to perform some operation that requires a lot of throughput. After you're done, you can reset the provisioned throughput to prior levels.

```js
var throughput = require('dynamodb-throughput')('my-table', 'us-east-1');
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
var throughput = require('dynamodb-throughput')('my-table', 'us-east-1');
var queue = require('queue-async');

queue(1)
  .defer(throughput.setIndexCapacity, 'my-index', { read: 1000, write: 1000 })
  .defer(doSomethingStrenuous)
  .defer(throughput.resetIndexCapacity, 'my-index')
  .awaitAll(function(err) {
    console.log(err || 'All done!');
  });
```
