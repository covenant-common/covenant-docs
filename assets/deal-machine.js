// One sample deal for the sandbox and the Matrix price check.
// Stage names match the installed work-order checks:
// PROPOSED, BOUND, DELIVERED, DISPUTED, DECIDED, SETTLED, RELEASED.
// QUOTE is only a sample step before anyone signs.
// Test USDC only. This file does not move hosted money.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CovenantDeal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FEE_BPS = 50;
  const SERVER_STATES = ['PROPOSED', 'BOUND', 'DELIVERED', 'DISPUTED', 'DECIDED', 'SETTLED', 'RELEASED'];
  const MESSAGES = {
    COUNTERPARTY_ASSENT: 'The other person has not signed this version yet. Nothing is agreed and no test money has moved.',
    AGENT_ASSENT: 'The buyer’s signature no longer matches, because the price was changed after it was signed.',
    SIGNATURE: 'A signature no longer matches these exact terms.',
    SETTLEMENT_BINDING: 'The held test funds no longer match the signed price.',
    NOT_DELIVERABLE: 'Delivery waits until both sides have accepted the same terms.',
    NOT_SETTLEABLE: 'Release waits until the work is delivered, or until a dispute has a decision.',
    DISPUTE_OPEN: 'A dispute is open. The test funds stay held until the resolver records a decision.',
    OUT_OF_ORDER: 'That step is not available yet. Use the step that is offered now.',
    NEGATIVE_PRICE: 'A price cannot be negative.',
    MISSING_CURRENCY: 'Add a currency, such as USD, GBP, EUR or USDC.',
    NOT_A_PRICE: 'Use a number and a currency, such as USD 25. “A hundred quid” is not a price.',
    MISSING_PRICE: 'Enter a price, or type No payment.'
  };

  function formatThousandths(value) {
    const sign = value < 0 ? '-' : '';
    const whole = Math.floor(Math.abs(value) / 1000);
    const frac = Math.abs(value) % 1000;
    if (!frac) return sign + String(whole);
    return sign + whole + '.' + String(frac).padStart(3, '0').replace(/0+$/, '');
  }

  function feeSplit(amount) {
    const units = Number(amount);
    if (!Number.isFinite(units) || units < 0) return null;
    const thousandths = Math.round(units * 1000);
    const fee = Math.round(thousandths * FEE_BPS / 10000);
    return {
      price: formatThousandths(thousandths),
      youPayOff: formatThousandths(thousandths),
      sellerGets: formatThousandths(thousandths),
      feeOff: '0',
      youPayOn: formatThousandths(thousandths + fee),
      feeOn: formatThousandths(fee),
      ledgerCollectsFee: false
    };
  }

  function moneyText(split, currency) {
    if (!split) return '';
    const unit = currency || 'test USDC';
    return 'Fee 0.5%. Waived while you leave it off: you pay ' + split.youPayOff + ' ' + unit + ', the seller gets ' + split.sellerGets + ' ' + unit + ', and the fee is ' + split.feeOff + '. When the 0.5% fee applies: you pay ' + split.youPayOn + ' ' + unit + ', the seller gets ' + split.sellerGets + ' ' + unit + ', and the fee is ' + split.feeOn + '. The waiver is the default. It is optional for the first 14 days from 1 November 2026. This site does not state when that window ends. This sample ledger does not collect the fee.';
  }

  function validatePrice(raw) {
    const value = String(raw == null ? '' : raw).trim();
    if (!value) return {ok: false, message: MESSAGES.MISSING_PRICE};
    if (/(^|[^\d])-\s*\d/.test(value) || /^-\d/.test(value)) return {ok: false, message: MESSAGES.NEGATIVE_PRICE};
    if (/^no payment$/i.test(value)) return {ok: true, canonical: 'No payment', kind: 'none'};
    const exchange = value.match(/^agreed exchange:\s+(\S[\s\S]{0,200})$/i);
    if (exchange) return {ok: true, canonical: 'Agreed exchange: ' + exchange[1].trim(), kind: 'exchange'};
    const money = value.match(/^(USD|GBP|EUR|USDC)\s+([0-9]+)(?:\.([0-9]{1,2}))?$/i);
    if (!money) {
      if (/[a-z]/i.test(value) && !/^(USD|GBP|EUR|USDC)\b/i.test(value)) return {ok: false, message: MESSAGES.NOT_A_PRICE};
      if (/^[0-9]/.test(value)) return {ok: false, message: MESSAGES.MISSING_CURRENCY};
      return {ok: false, message: MESSAGES.NOT_A_PRICE};
    }
    const currency = money[1].toUpperCase();
    const canonical = currency + ' ' + money[2] + (money[3] ? '.' + money[3] : '');
    return {ok: true, canonical: canonical, kind: 'money', currency: currency, amount: Number(money[2] + '.' + (money[3] || '0'))};
  }

  function createSample() {
    let phase = 'ready';
    let price = 20;
    let buyer = 100;
    let seller = 0;
    let held = 0;
    function view(step, said, serverState) {
      const split = feeSplit(price);
      return {
        step: step,
        serverState: serverState,
        said: said,
        buyer: buyer,
        seller: seller,
        held: held,
        price: price,
        split: split,
        money: 'Buyer has ' + buyer + ' test USDC. Held: ' + held + '. Seller has ' + seller + '.',
        feeText: moneyText(split, 'test USDC'),
        testFunds: true,
        bindsRealPerson: false
      };
    }
    const steps = {
      quote: function () {
        if (phase !== 'ready') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'quote';
        price = 20;
        return view('quote', 'Quote: 20 test USDC. Nothing is signed and no test money has moved.', 'QUOTE');
      },
      offer: function () {
        if (phase !== 'quote') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'offer';
        return view('offer', 'The buyer offers 20 test USDC. Stage PROPOSED. The sample does not send this to the seller.', 'PROPOSED');
      },
      counter: function () {
        if (phase !== 'offer') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'counter';
        price = 30;
        return view('counter', 'The seller counters at 30 test USDC. This is a new PROPOSED draft. It is not linked to the previous one.', 'PROPOSED');
      },
      agree: function () {
        if (phase !== 'counter') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'agree';
        price = 25;
        return view('agree', 'The price to sign is 25 test USDC. Still PROPOSED. Nothing is held until you accept.', 'PROPOSED');
      },
      accept: function () {
        if (phase !== 'agree' && phase !== 'counter' && phase !== 'offer') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'accepted';
        return view('accept', 'Accepted in this sample. Both sides have the same version. Test funds stay in the buyer’s balance until you fund the hold. This does not bind a real person.', 'PROPOSED');
      },
      fund: function () {
        if (phase !== 'accepted') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'bound';
        held = price;
        buyer = 100 - price;
        return view('fund', 'Funded. Stage BOUND. ' + price + ' test USDC is held. It is not in the seller’s balance yet.', 'BOUND');
      },
      deliver: function () {
        if (phase !== 'bound') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'delivered';
        return view('deliver', 'Delivered. Stage DELIVERED. The 25 test USDC stays held.', 'DELIVERED');
      },
      release: function () {
        if (phase !== 'delivered') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'settled';
        held = 0;
        seller = 25;
        return view('release', 'Released. Stage SETTLED. The seller has the 25 test USDC. Test money only.', 'SETTLED');
      },
      dispute: function () {
        if (phase !== 'delivered') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'disputed';
        return view('dispute', 'Disputed. Stage DISPUTED. The 25 test USDC stays held while the resolver looks at the reason.', 'DISPUTED');
      },
      refund: function () {
        if (phase !== 'disputed') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'released';
        held = 0;
        buyer = 100;
        return view('refund', 'The resolver records REFUTED. Stage RELEASED. The 25 test USDC is refunded to the buyer. Test money only. Hosted USDC has no refund.', 'RELEASED');
      }
    };
    return {
      step: function (name) {
        const fn = steps[name];
        if (!fn) return {error: MESSAGES.OUT_OF_ORDER};
        return fn();
      },
      phase: function () { return phase; }
    };
  }

  return {
    FEE_BPS: FEE_BPS,
    SERVER_STATES: SERVER_STATES,
    MESSAGES: MESSAGES,
    feeSplit: feeSplit,
    moneyText: moneyText,
    validatePrice: validatePrice,
    createSample: createSample,
    explain: function (code) { return MESSAGES[code] || 'Something in the sample stopped. Run the step again. No real money moved.'; }
  };
});
