// One sample deal for the sandbox and the Matrix price check.
// Every label, button and amount comes from the state object this file returns.
// Stage names match the installed work-order checks, plus ACCEPTED before a hold.
// Test USDC only. This file does not move hosted money.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CovenantDeal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FEE_BPS = 50;
  const SERVER_STATES = ['PROPOSED', 'ACCEPTED', 'BOUND', 'DELIVERED', 'DISPUTED', 'DECIDED', 'SETTLED', 'RELEASED'];
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
    MISSING_PRICE: 'Enter a price, or type No payment.',
    CHOOSE_CURRENCY: 'Choose a currency.'
  };
  const AUTHORS = {
    propose: 'Buyer', counter: 'Seller', agree: 'Buyer', accept: 'Both', decline: 'Buyer',
    fund: 'Buyer', deliver: 'Seller', release: 'Buyer', dispute: 'Buyer', refund: 'Resolver'
  };

  function halfUp(numerator, denominator) {
    return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
  }

  function formatMinor(minor) {
    const sign = minor < 0 ? '-' : '';
    const abs = Math.abs(minor);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    if (!frac) return sign + String(whole);
    return sign + whole + '.' + String(frac).padStart(2, '0').replace(/0+$/, '');
  }

  function feeSplit(amount) {
    const units = Number(amount);
    if (!Number.isFinite(units) || units < 0) return null;
    const minor = Math.round(units * 100);
    const fee = halfUp(minor * FEE_BPS, 10000);
    return {
      price: formatMinor(minor),
      youPayOff: formatMinor(minor),
      sellerGets: formatMinor(minor),
      feeOff: '0',
      youPayOn: formatMinor(minor + fee),
      feeOn: formatMinor(fee),
      feeMinor: fee,
      ledgerCollectsFee: false
    };
  }

  function moneyText(split, currency) {
    if (!split) return '';
    const unit = currency || 'test USDC';
    return 'The platform fee is not set yet. The owner will confirm this. This sample does not add a fee. You pay ' + split.price + ' ' + unit + ' and the seller gets ' + split.sellerGets + ' ' + unit + '.';
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

  function priceFieldErrors(currency, amount) {
    const raw = String(amount == null ? '' : amount).trim();
    const chosen = String(currency == null ? '' : currency);
    const currencyMessage = chosen ? '' : MESSAGES.CHOOSE_CURRENCY;
    let amountMessage = '';
    if (chosen === 'none') amountMessage = '';
    else if (raw && !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(raw)) amountMessage = MESSAGES.NOT_A_PRICE;
    else if (chosen && chosen !== 'none' && !raw) amountMessage = MESSAGES.MISSING_PRICE;
    return {currencyMessage: currencyMessage, amountMessage: amountMessage};
  }

  function createSample(options) {
    const opts = options || {};
    const now = opts.now || function () { return new Date().toISOString(); };
    let phase = 'ready';
    let stage = 'READY';
    let price = 20;
    let buyer = 100;
    let seller = 0;
    let held = 0;
    let said = 'Not started. Propose when you are ready.';
    let recordId = null;
    let releasedAmount = 0;
    const history = [];
    let recordCount = 0;

    function buttons() {
      return {
        propose: {label: phase === 'ready' ? 'Propose' : 'Proposed', enabled: phase === 'ready'},
        counter: {label: 'Counter', enabled: phase === 'offer'},
        agree: {label: 'Counter again', enabled: phase === 'counter'},
        accept: {label: 'Accept', enabled: phase === 'offer' || phase === 'counter' || phase === 'agree'},
        decline: {label: 'Decline', enabled: phase === 'offer' || phase === 'counter' || phase === 'agree'},
        fund: {label: 'Fund', enabled: phase === 'accepted'},
        deliver: {label: 'Deliver', enabled: phase === 'bound'},
        release: {label: 'Release', enabled: phase === 'delivered'},
        dispute: {label: 'Dispute', enabled: phase === 'delivered'},
        refund: {label: 'Refund', enabled: phase === 'disputed'}
      };
    }

    function view() {
      const split = feeSplit(price);
      return {
        phase: phase,
        step: phase,
        stage: stage,
        serverState: stage,
        said: said,
        buyer: buyer,
        seller: seller,
        held: held,
        price: price,
        recordId: recordId,
        history: history.map(function (row) { return Object.assign({}, row); }),
        buttons: buttons(),
        split: split,
        money: 'Buyer has ' + buyer + ' test USDC. Held: ' + held + '. Seller has ' + seller + '.',
        feeText: moneyText(split, 'test USDC'),
        testFunds: true,
        bindsRealPerson: false
      };
    }

    function remember(step, text) {
      history.push({at: now(), author: AUTHORS[step] || 'Sample', text: text, amount: price, held: held, stage: stage});
    }

    const steps = {
      propose: function () {
        if (phase !== 'ready') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'offer';
        stage = 'PROPOSED';
        price = 20;
        said = 'Proposed. Stage PROPOSED. The price is 20 test USDC. Nothing is signed and no test money has moved.';
        remember('propose', said);
        return view();
      },
      counter: function () {
        if (phase !== 'offer') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'counter';
        stage = 'PROPOSED';
        price = 30;
        said = 'The seller counters at 30 test USDC. Stage PROPOSED. This replaces the 20 test USDC proposal.';
        remember('counter', said);
        return view();
      },
      agree: function () {
        if (phase !== 'counter') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'agree';
        stage = 'PROPOSED';
        price = 25;
        said = 'The price to sign is 25 test USDC. Stage PROPOSED. Nothing is held until you accept.';
        remember('agree', said);
        return view();
      },
      accept: function () {
        if (phase !== 'agree' && phase !== 'counter' && phase !== 'offer') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'accepted';
        stage = 'ACCEPTED';
        recordCount += 1;
        recordId = 'rec-' + recordCount;
        said = 'Accepted. Stage ACCEPTED. The signed price is ' + price + ' test USDC. Test funds stay with the buyer until you fund the hold.';
        remember('accept', said);
        return view();
      },
      fund: function () {
        if (phase !== 'accepted') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'bound';
        stage = 'BOUND';
        held = price;
        buyer = 100 - price;
        said = 'Funded. Stage BOUND. ' + held + ' test USDC is held. It is not in the seller’s balance yet.';
        remember('fund', said);
        return view();
      },
      deliver: function () {
        if (phase !== 'bound') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'delivered';
        stage = 'DELIVERED';
        said = 'Delivered. Stage DELIVERED. The ' + held + ' test USDC stays held.';
        remember('deliver', said);
        return view();
      },
      release: function () {
        if (phase !== 'delivered') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'settled';
        stage = 'SETTLED';
        releasedAmount = held;
        seller += held;
        held = 0;
        said = 'Released. Stage SETTLED. The seller has the ' + releasedAmount + ' test USDC. Test money only.';
        remember('release', said);
        return view();
      },
      dispute: function () {
        if (phase !== 'delivered') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'disputed';
        stage = 'DISPUTED';
        said = 'Disputed. Stage DISPUTED. The ' + held + ' test USDC stays held.';
        remember('dispute', said);
        return view();
      },
      decline: function () {
        if (phase !== 'offer' && phase !== 'counter' && phase !== 'agree') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'declined';
        stage = 'PROPOSED';
        said = 'Declined. Stage PROPOSED. No test funds moved.';
        remember('decline', said);
        return view();
      },
      refund: function () {
        if (phase !== 'disputed') return {error: MESSAGES.OUT_OF_ORDER};
        phase = 'released';
        stage = 'Refunded';
        const returned = held;
        buyer += held;
        held = 0;
        said = returned + ' test USDC is back with the buyer. Signed with a test key. No real money moved. This return is the test rail. Hosted USDC on the public service is final.';
        remember('refund', said);
        return view();
      }
    };

    return {
      step: function (name) {
        const fn = steps[name];
        if (!fn) return {error: MESSAGES.OUT_OF_ORDER};
        return fn();
      },
      state: view,
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
    priceFieldErrors: priceFieldErrors,
    createSample: createSample,
    explain: function (code) { return MESSAGES[code] || 'Something in the sample stopped. Run the step again. No real money moved.'; }
  };
});
