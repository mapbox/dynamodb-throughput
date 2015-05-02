# dynamodb-throughput

[![Build Status](https://travis-ci.org/mapbox/dynamodb-throughput.svg?branch=master)](https://travis-ci.org/mapbox/dynamodb-throughput)

Set and reset provisioned DynamoDB throughput

## Usage

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
