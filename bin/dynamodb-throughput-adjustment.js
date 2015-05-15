#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2));
var region = args._[0].split('/')[0];
var table = args._[0].split('/')[1];
var throughput = require('..')(table, { region: region });

var adjustment = {};

for (var key in args) {
  if (key.split('-').length === 2) {
    if (key.split('-')[0] === 'main') {
      adjustment.main = adjustment.main || {};
      adjustment.main[key.split('-')[1]] = Number(args[key]);
    } else {
      adjustment.indexes = adjustment.indexes || {};
      adjustment.indexes[key.split('-')[0]] = {};
      adjustment.indexes[key.split('-')[0]][key.split('-')[1]] = Number(args[key]);
    }
  }
}

throughput.adjustedTableInfo(adjustment, function(err, info, warnings) {
  if (err) throw err;

  if (warnings.main) console.error('WARNING: This adjustment would force the table to be repartitioned');
  for (var index in warnings.indexes) {
    console.error('WARNING: This adjustment would force the %s index to be repartitioned', index);
  }

  console.log(JSON.stringify(info, null, 2));
});
