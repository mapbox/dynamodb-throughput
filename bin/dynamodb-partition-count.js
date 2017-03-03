#!/usr/bin/env node

var region = process.argv[2].split('/')[0];
var table = process.argv[2].split('/')[1];
var throughput = require('..')(table, { region: region });

throughput.partitionCount(function(err, partitionCount) {
  if (err) throw err;
  console.log('Found %s partitions', partitionCount);
});
