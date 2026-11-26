'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function hsnRiceOrder(overrides) {
  var order = {
    id: 42,
    date: '26/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }]
  };
  Object.keys(overrides || {}).forEach(function (key) { order[key] = overrides[key]; });
  return order;
}

test('INVOICE BEHAVIOUR: HSN slab, tax split, and invoice totals match order pricing', function () {
  var order = hsnRiceOrder();
  var ledger = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total, printed.rows[0].gstPercent, printed.rows[0].lineTax],
    [ledger.subtotal, ledger.discount, ledger.tax, ledger.cgst, ledger.sgst, ledger.total, ledger.lines[0].gstPercent, ledger.lines[0].tax]
  );
});

test('INVOICE BEHAVIOUR: percentage coupon uses pricing cap and post-discount GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 10 }];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(hsnRiceOrder({ items: items, coupon: 'SAVE10' }));
  assert.deepEqual([printed.discount, printed.tax, printed.total], [ledger.discount, ledger.tax, ledger.total]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [100, 45, 945]);
});

test('INVOICE BEHAVIOUR: inactive coupon has no discount in invoice figures', function () {
  var order = hsnRiceOrder({ coupon: 'DIWALI20' });
  var ledger = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [ledger.discount, ledger.tax, ledger.total]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [0, 5, 105]);
});

test('INVOICE BEHAVIOUR: decimal gstRate is interpreted consistently with order pricing', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  var ledger = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(hsnRiceOrder({ items: items }));
  assert.deepEqual([printed.rows[0].gstPercent, printed.tax], [ledger.lines[0].gstPercent, ledger.tax]);
  assert.deepEqual([printed.rows[0].gstPercent, printed.tax], [5, 5]);
});

test('INVOICE BEHAVIOUR: reconciliation matches an in-memory HSN order billed by pricing', function () {
  var order = hsnRiceOrder({ subtotal: 100, discount: 0, tax: 5, total: 105 });
  var result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('INVOICE BEHAVIOUR: rendered invoice uses matching figures without a ledger mismatch notice', function () {
  var order = hsnRiceOrder({ subtotal: 100, discount: 0, tax: 5, total: 105 });
  var html = invoice.render(order);
  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, /₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
