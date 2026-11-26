'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

test('invoice uses the same HSN GST breakdown and totals as the billed order', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ id: 1, items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.deepEqual(
    { gstPercent: printed.rows[0].gstPercent, lineTax: printed.rows[0].lineTax },
    { gstPercent: billed.lines[0].gstPercent, lineTax: billed.lines[0].tax }
  );
});
