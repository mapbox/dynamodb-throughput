#!/usr/bin/env node

var region = process.argv[2].split('/')[0];
var table = process.argv[2].split('/')[1];
var throughput = require('..')(table, { region: region });

throughput.tableInfo(function(err, info) {
  if (err) throw err;
  console.log(JSON.stringify(info, null, 2));
});
