import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const deal = require('../assets/deal-machine.js');

test('a vague price and a negative price are refused', () => {
  assert.equal(deal.validatePrice('a hundred quid maybe').ok, false);
  assert.match(deal.validatePrice('a hundred quid maybe').message, /a hundred quid maybe/);
  assert.equal(deal.validatePrice('USD -25').ok, false);
  assert.match(deal.validatePrice('-5').message, /negative/);
  assert.equal(deal.validatePrice('25').ok, false);
  assert.equal(deal.validatePrice('USD 25').canonical, 'USD 25');
  assert.equal(deal.validatePrice('No payment').ok, true);
});

test('one propose changes the label, and every later amount follows that state', () => {
  const sample = deal.createSample({now: () => '2026-11-04T14:00:00.000Z'});
  const start = sample.state();
  assert.equal(start.buttons.propose.label, 'Propose');
  assert.equal(start.buttons.propose.enabled, true);
  const proposed = sample.step('propose');
  assert.equal(proposed.buttons.propose.label, 'Proposed');
  assert.equal(proposed.buttons.propose.enabled, false);
  assert.equal(proposed.stage, 'PROPOSED');
  assert.equal(proposed.price, 20);
  const accepted = sample.step('accept');
  assert.equal(accepted.stage, 'ACCEPTED');
  assert.equal(accepted.recordId, 'rec-1');
  assert.match(accepted.history[1].at, /2026-11-04/);
  assert.equal(accepted.history[1].author, 'Both');
  const funded = sample.step('fund');
  assert.equal(funded.held, 20);
  assert.equal(funded.stage, 'BOUND');
  const delivered = sample.step('deliver');
  assert.match(delivered.said, /20 test USDC/);
  assert.doesNotMatch(delivered.said, /25/);
  const disputed = sample.step('dispute');
  assert.match(disputed.said, /20 test USDC/);
  const refunded = sample.step('refund');
  assert.equal(refunded.stage, 'Refunded');
  assert.match(sample.state().feeText, /not set yet/i);
  assert.doesNotMatch(sample.state().feeText, /0\.5%/);
  assert.equal(refunded.held, 0);
  assert.equal(refunded.buyer, 100);
  assert.equal(refunded.stage, 'Refunded');
  assert.match(refunded.said, /20 test USDC/);
  assert.doesNotMatch(refunded.said, /REFUTED/);
  assert.doesNotMatch(refunded.said, /RELEASED/);
});

test('the priced path keeps 25 after counter and agree', () => {
  const sample = deal.createSample();
  for (const name of ['propose', 'counter', 'agree', 'accept', 'fund', 'deliver', 'release']) {
    const row = sample.step(name);
    assert.equal(row.error, undefined, name);
    assert.equal(row.buttons[name === 'propose' ? 'propose' : name].label.length > 0, true);
  }
  assert.equal(sample.state().seller, 25);
  assert.equal(sample.phase(), 'settled');
});

test('a non-numeric amount is its own field message', () => {
  const both = deal.priceFieldErrors('', 'a hundred quid');
  assert.equal(both.currencyMessage, 'Choose a currency.');
  assert.match(both.amountMessage, /a hundred quid/);
  const amountOnly = deal.priceFieldErrors('USD', 'a hundred quid');
  assert.equal(amountOnly.currencyMessage, '');
  assert.match(amountOnly.amountMessage, /a hundred quid/);
});

test('engine codes are not the words a person sees', () => {
  assert.doesNotMatch(deal.explain('COUNTERPARTY_ASSENT'), /COUNTERPARTY_ASSENT/);
  assert.ok(deal.SERVER_STATES.includes('DISPUTED'));
  assert.ok(deal.SERVER_STATES.includes('RELEASED'));
});
