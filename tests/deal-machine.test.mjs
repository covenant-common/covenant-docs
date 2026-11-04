import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const deal = require('../assets/deal-machine.js');

test('a vague price and a negative price are refused', () => {
  assert.equal(deal.validatePrice('a hundred quid maybe').ok, false);
  assert.match(deal.validatePrice('a hundred quid maybe').message, /not a price/);
  assert.equal(deal.validatePrice('USD -25').ok, false);
  assert.match(deal.validatePrice('-5').message, /negative/);
  assert.equal(deal.validatePrice('25').ok, false);
  assert.equal(deal.validatePrice('USD 25').canonical, 'USD 25');
  assert.equal(deal.validatePrice('No payment').ok, true);
});

test('the sample walks quote, offer, counter, hold, dispute and refund', () => {
  const sample = deal.createSample();
  for (const name of ['quote', 'offer', 'counter', 'agree', 'accept', 'fund', 'deliver', 'dispute', 'refund']) {
    const row = sample.step(name);
    assert.equal(row.error, undefined, name);
    assert.match(row.feeText, /you pay/);
    assert.match(row.feeText, /seller gets/);
    assert.match(row.feeText, /fee is/);
  }
  const end = sample.step('refund');
  assert.ok(end.error);
  const happy = deal.createSample();
  for (const name of ['quote', 'offer', 'counter', 'agree', 'accept', 'fund', 'deliver', 'release']) happy.step(name);
  assert.equal(happy.phase(), 'settled');
});

test('engine codes are not the words a person sees', () => {
  assert.doesNotMatch(deal.explain('COUNTERPARTY_ASSENT'), /COUNTERPARTY_ASSENT/);
  assert.ok(deal.SERVER_STATES.includes('DISPUTED'));
  assert.ok(deal.SERVER_STATES.includes('RELEASED'));
});
