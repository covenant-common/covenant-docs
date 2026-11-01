/* Private, local pilot notes. No network calls, analytics or browser storage. */
(function (global) {
  'use strict';
  var VERSION = 'aap-pilot-workbook/1';
  var MAX_BYTES = 262144;
  var ASSETS = {
    USD: { scale: 100, digits: 2, maxAmount: 1000000000, label: 'USD', minor: 'cents' },
    GBP: { scale: 100, digits: 2, maxAmount: 1000000000, label: 'GBP', minor: 'pence' },
    EUR: { scale: 100, digits: 2, maxAmount: 1000000000, label: 'EUR', minor: 'cents' },
    USDC_BASE: { scale: 1000000, digits: 6, maxAmount: 1000000000000, label: 'USDC_BASE', minor: 'USDC micro-units on Base (eip155:8453)' },
    USDC_ETHEREUM: { scale: 1000000, digits: 6, maxAmount: 1000000000000, label: 'USDC_ETHEREUM', minor: 'USDC micro-units on Ethereum (eip155:1)' }
  };
  var CURRENCIES = Object.keys(ASSETS);
  var DATES = ['approachedOn', 'agreedOn', 'setupOn', 'approvedOn', 'deliveredOn', 'reviewedOn', 'reopenedOn', 'secondJobOn', 'offerOn', 'abandonedOn'];
  var NUMBERS = ['baselineMinutes', 'covenantMinutes', 'baselineDefects', 'covenantDefects', 'gmvMinor', 'collectedRevenueMinor', 'providerCostsMinor', 'partnerCostsMinor', 'refundDisputeCostsMinor', 'supportMinutes', 'supportRateMinorPerHour', 'founderMinutes', 'founderRateMinorPerHour'];
  var TEXT = { id: 40, goal: 160, baselineProcess: 240, reason: 240, firstJobRef: 40, secondJobRef: 40 };
  var CHOICES = {
    kind: ['real', 'synthetic'], source: ['direct', 'partner', 'referral', 'community', 'search', 'directory', 'other', 'unknown'],
    assistance: ['assisted', 'independent', 'mixed', 'unknown'], permission: ['recorded', 'not-recorded'],
    evidence: ['self-reported', 'operator-observed', 'record-reviewed', 'unknown'],
    firstResult: ['accepted', 'correction-needed', 'disputed', 'unknown'],
    offerDecision: ['not-offered', 'accepted', 'refused', 'no-response', 'unknown']
  };
  var BOOLS = ['baselineComparable', 'secondVoluntary'];
  var FIELDS = Object.keys(TEXT).concat(Object.keys(CHOICES), BOOLS, DATES, NUMBERS);
  var STAGES = [
    ['approachedOn', 'Qualified operator approached'], ['agreedOn', 'Pilot agreed'], ['setupOn', 'Setup attempted'],
    ['approvedOn', 'Exact first-order approval'], ['deliveredOn', 'First job delivered'], ['reviewedOn', 'First job reviewed'],
    ['reopenedOn', 'First record reopened']
  ];
  var SECRET = /(?:\b(?:sk[_-](?:proj[_-])?|rk_|whsec_|Bearer\s+)|\b[a-f0-9]{64}\b|["']?(?:private_seed|private_key|access_token|api_key)["']?\s*[:=]|-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----)/i;
  function fail(message) { throw new Error(message); }
  function need(value, message) { if (!value) fail(message); }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function exact(value, fields, label) {
    need(plain(value) && Object.keys(value).length === fields.length && fields.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); }), 'Unexpected or missing fields in ' + label + '.');
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function byteLength(value) { return new TextEncoder().encode(value).length; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function day(value) {
    need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use complete calendar dates.');
    var time = Date.parse(value + 'T00:00:00Z');
    need(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31', 'Use a valid calendar date between 2000 and 2100.');
    return time / 86400000;
  }
  function integer(value, max, label) {
    need(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value <= max, 'Use a non-negative whole number within the limit for ' + label + '.');
  }
  function arithmeticBudget(input) {
    // Bound every possible filtered group's money calculations before state can
    // change. Absolute terms are conservative: cancellation cannot hide excess.
    var budget = 0, limit = Number.MAX_SAFE_INTEGER - 30;
    function add(value) {
      need(Number.isSafeInteger(value) && value >= 0 && value <= limit - budget, 'Combined money and time costs exceed exact arithmetic limits. Split this workbook or reduce the recorded range; no totals were saved.');
      budget += value;
    }
    input.pilots.forEach(function (row) {
      ['gmvMinor', 'collectedRevenueMinor', 'providerCostsMinor', 'partnerCostsMinor', 'refundDisputeCostsMinor'].forEach(function (name) { if (row[name] !== null) add(row[name] * 60); });
      if (row.supportMinutes !== null && row.supportRateMinorPerHour !== null) add(row.supportMinutes * row.supportRateMinorPerHour);
      if (row.founderMinutes !== null && row.founderRateMinorPerHour !== null) add(row.founderMinutes * row.founderRateMinorPerHour);
    });
  }
  function safeText(value, max, label) {
    need(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Keep ' + label + ' within its displayed length limit and omit control characters.');
    need(!SECRET.test(value), 'Remove keys, tokens and private records. Use short non-sensitive references instead.');
  }
  function reference(value, optional) {
    need(typeof value === 'string' && (optional && value === '' || /^[A-Za-z][A-Za-z0-9_-]{1,39}$/.test(value)), 'References must start with a letter and use 2–40 letters, digits, dashes or underscores.');
    safeText(value, 40, 'reference');
  }
  function emptyWorkbook(on) {
    on = on || today(); day(on);
    return { version: VERSION, currency: 'USD', window: { start: on, end: on, asOf: on, repeatDays: 7 }, pilots: [] };
  }
  function defaultPilot() {
    var row = {};
    Object.keys(TEXT).forEach(function (name) { row[name] = ''; });
    Object.keys(CHOICES).forEach(function (name) { row[name] = CHOICES[name][CHOICES[name].length - 1]; });
    row.kind = 'real'; row.permission = 'not-recorded'; row.offerDecision = 'not-offered';
    BOOLS.forEach(function (name) { row[name] = false; });
    DATES.forEach(function (name) { row[name] = ''; });
    NUMBERS.forEach(function (name) { row[name] = null; });
    return row;
  }
  function validateWorkbook(input, options) {
    var current = options && options.today || today(); day(current);
    exact(input, ['version', 'currency', 'window', 'pilots'], 'workbook');
    need(input.version === VERSION, 'Unsupported workbook version.');
    need(CURRENCIES.includes(input.currency), 'Choose USD, GBP, EUR, USDC_BASE or USDC_ETHEREUM. Each workbook uses one exact asset; no conversion or peg is assumed.');
    exact(input.window, ['start', 'end', 'asOf', 'repeatDays'], 'observation window');
    var w = input.window;
    day(w.start); day(w.end); day(w.asOf);
    need(w.start <= w.end && w.end <= w.asOf && w.asOf <= current, 'Use cohort start ≤ cohort end ≤ As of ≤ today.');
    integer(w.repeatDays, 90, 'repeat observation days'); need(w.repeatDays >= 1, 'Observe repeat use for at least one day.');
    need(Array.isArray(input.pilots) && input.pilots.length <= 100, 'Keep at most 100 pilot records in one workbook.');
    var ids = new Set(), jobs = new Set();
    input.pilots.forEach(function (row) {
      exact(row, FIELDS, 'pilot record');
      Object.keys(TEXT).forEach(function (name) { safeText(row[name], TEXT[name], name); });
      reference(row.id, false); reference(row.firstJobRef, true); reference(row.secondJobRef, true);
      need(!ids.has(row.id.toLowerCase()), 'Each operator/pilot reference must be unique, including letter case.'); ids.add(row.id.toLowerCase());
      [row.firstJobRef, row.secondJobRef].filter(Boolean).forEach(function (ref) {
        need(!jobs.has(ref.toLowerCase()), 'A job reference can appear only once across all first and second jobs.'); jobs.add(ref.toLowerCase());
      });
      need(row.goal.trim().length > 0, 'Describe one useful job in the goal field.');
      Object.keys(CHOICES).forEach(function (name) { need(CHOICES[name].includes(row[name]), 'Choose a displayed answer for ' + name + '.'); });
      BOOLS.forEach(function (name) { need(typeof row[name] === 'boolean', 'Use a checkbox answer for ' + name + '.'); });
      need(row.approachedOn !== '', 'Record when the qualified operator was approached.');
      DATES.forEach(function (name) {
        need(typeof row[name] === 'string', 'Use a date or leave the date blank.');
        if (row[name]) { day(row[name]); need(row[name] <= w.asOf && row[name] >= row.approachedOn, 'Milestone dates must be on or after approach and on or before As of. Future outcomes cannot be recorded.'); }
      });
      var ordered = ['approvedOn', 'deliveredOn', 'reviewedOn', 'reopenedOn'];
      ordered.forEach(function (name, i) { ordered.slice(i + 1).forEach(function (later) {
        if (row[name] && row[later]) need(row[name] <= row[later], 'Known first-job approval, delivery, review and reopening dates must be in that order. Missing dates are allowed and are never inferred.');
      }); });
      if (['approvedOn', 'deliveredOn', 'reviewedOn', 'reopenedOn'].some(function (name) { return !!row[name]; })) need(row.firstJobRef !== '', 'Add the first job reference before recording its milestones.');
      if (row.secondJobOn) {
        need(row.secondJobRef !== '', 'Add a distinct second job reference before recording its completion.');
        if (row.reviewedOn) need(row.secondJobOn >= row.reviewedOn, 'The second completed job cannot precede review of the first.');
      }
      if (row.offerDecision === 'not-offered') need(row.offerOn === '', 'Leave the offer date blank when no offer was made.');
      else need(row.offerOn !== '', 'Record the date of the offer or decision. An accepted offer does not establish collected revenue.');
      NUMBERS.forEach(function (name) {
        if (row[name] !== null) integer(row[name], /Minutes$/.test(name) ? 100000 : /Defects$/.test(name) ? 10000 : /RateMinorPerHour$/.test(name) ? 1000000000 : ASSETS[input.currency].maxAmount, name);
      });
    });
    arithmeticBudget(input);
    need(byteLength(JSON.stringify(input)) + 1 <= MAX_BYTES, 'The saved workbook exceeds 256 KiB. Shorten notes or use a separate workbook.');
    return clone(input);
  }
  function parseLocalJSON(text, maxBytes) {
    need(typeof text === 'string' && text.length <= maxBytes && byteLength(text) <= maxBytes, 'Choose a JSON workbook no larger than 256 KiB.');
    // A small closed parser rejects duplicate JSON keys before they can be lost
    // by JSON.parse. Null-prototype objects also keep __proto__ inert.
    var i = 0, nodes = 0;
    function ws() { while (i < text.length && /[\t\n\r ]/.test(text[i])) i++; }
    function string() {
      need(text[i] === '"', 'Invalid JSON string.'); var start = i++;
      while (i < text.length) {
        var ch = text[i++];
        if (ch === '"') {
          try { return JSON.parse(text.slice(start, i)); } catch (error) { fail('Invalid JSON string.'); }
        }
        if (ch === '\\') i++;
      }
      fail('Incomplete JSON string.');
    }
    function value(depth) {
      need(depth <= 12 && ++nodes <= 10000, 'Workbook nesting or size exceeds the limit.'); ws();
      if (text[i] === '"') return string();
      if (text[i] === '{') {
        i++; ws(); var object = Object.create(null), names = new Set();
        if (text[i] === '}') { i++; return object; }
        while (i < text.length) {
          ws(); var key = string(); need(!names.has(key), 'Duplicate JSON field.'); names.add(key);
          ws(); need(text[i++] === ':', 'Invalid JSON object.'); object[key] = value(depth + 1); ws();
          if (text[i] === '}') { i++; return object; }
          need(text[i++] === ',', 'Invalid JSON object.');
        }
        fail('Incomplete JSON object.');
      }
      if (text[i] === '[') {
        i++; ws(); var array = [];
        if (text[i] === ']') { i++; return array; }
        while (i < text.length) {
          array.push(value(depth + 1)); ws();
          if (text[i] === ']') { i++; return array; }
          need(text[i++] === ',', 'Invalid JSON array.');
        }
        fail('Incomplete JSON array.');
      }
      for (var literal of [['true', true], ['false', false], ['null', null]]) {
        if (text.slice(i, i + literal[0].length) === literal[0]) { i += literal[0].length; return literal[1]; }
      }
      var matched = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
      need(matched !== null, 'Invalid JSON value.'); i += matched[0].length;
      var number = Number(matched[0]); need(Number.isSafeInteger(number) && !Object.is(number, -0), 'Workbook numbers must be finite safe whole numbers.');
      return number;
    }
    var parsed = value(0); ws(); need(i === text.length, 'Unexpected text after the JSON workbook.');
    return parsed;
  }
  function parseWorkbook(text, options) { return validateWorkbook(parseLocalJSON(text, MAX_BYTES), options); }
  function serialize(input, options) { return JSON.stringify(validateWorkbook(input, options)) + '\n'; }
  function cashComplete(row) { return ['collectedRevenueMinor', 'providerCostsMinor', 'partnerCostsMinor', 'refundDisputeCostsMinor'].every(function (key) { return row[key] !== null; }); }
  function economics(row) {
    var cash = cashComplete(row) ? row.collectedRevenueMinor - row.providerCostsMinor - row.partnerCostsMinor - row.refundDisputeCostsMinor : null;
    var support = row.supportMinutes !== null && row.supportRateMinorPerHour !== null ? row.supportMinutes * row.supportRateMinorPerHour : null;
    var founder = row.founderMinutes !== null && row.founderRateMinorPerHour !== null ? row.founderMinutes * row.founderRateMinorPerHour : null;
    return { cashMinor: cash, supportSixtieths: support, founderSixtieths: founder,
      afterSupportSixtieths: cash !== null && support !== null ? cash * 60 - support : null,
      afterFounderSixtieths: cash !== null && support !== null && founder !== null ? cash * 60 - support - founder : null };
  }
  function firstComplete(row) { return !!(row.approvedOn && row.deliveredOn && row.reviewedOn && row.firstResult === 'accepted'); }
  function repeated(row) { return firstComplete(row) && !!row.secondJobOn && row.secondVoluntary && !!row.firstJobRef && !!row.secondJobRef; }
  function measure(rows, window) {
    var n = rows.length;
    var stages = STAGES.map(function (stage, index) {
      var previous = index ? STAGES[index - 1][0] : null;
      var observed = rows.filter(function (row) { return !!row[stage[0]]; });
      return { label: stage[1], observed: observed.length, cohortDenominator: n,
        previous: index ? STAGES[index - 1][1] : 'Cohort',
        previousDenominator: previous ? rows.filter(function (row) { return !!row[previous]; }).length : n,
        transition: previous ? observed.filter(function (row) { return !!row[previous]; }).length : observed.length,
        missingPrevious: previous ? observed.filter(function (row) { return !row[previous]; }).length : 0 };
    });
    var completed = rows.filter(firstComplete);
    var mature = completed.filter(function (row) { return day(window.asOf) - day(row.reviewedOn) >= window.repeatDays; });
    var pairedTime = rows.filter(function (row) { return row.baselineComparable && row.baselineMinutes !== null && row.covenantMinutes !== null; });
    var pairedDefects = rows.filter(function (row) { return row.baselineComparable && row.baselineDefects !== null && row.covenantDefects !== null; });
    var money = rows.map(economics);
    function total(key) { return n > 0 && money.every(function (entry) { return entry[key] !== null; }) ? money.reduce(function (sum, entry) { return sum + entry[key]; }, 0) : null; }
    function known(key) { return money.filter(function (entry) { return entry[key] !== null; }).length; }
    function sumKnown(name) { return n > 0 && rows.every(function (row) { return row[name] !== null; }) ? rows.reduce(function (sum, row) { return sum + row[name]; }, 0) : null; }
    return { count: n, stages: stages, completed: completed.length,
      repeated: rows.filter(repeated).length, repeatDenominator: completed.length,
      matureRepeated: mature.filter(repeated).length, matureDenominator: mature.length,
      missingFirstCompletion: rows.filter(function (row) { return !!row.secondJobOn && !firstComplete(row); }).length,
      secondNotVoluntary: rows.filter(function (row) { return !!row.secondJobOn && !row.secondVoluntary; }).length,
      abandoned: rows.filter(function (row) { return !!row.abandonedOn; }).length,
      offered: rows.filter(function (row) { return row.offerDecision !== 'not-offered'; }).length,
      accepted: rows.filter(function (row) { return row.offerDecision === 'accepted'; }).length,
      refused: rows.filter(function (row) { return row.offerDecision === 'refused'; }).length,
      assistance: CHOICES.assistance.map(function (name) { return { label: name, count: rows.filter(function (row) { return row.assistance === name; }).length }; }),
      evidence: CHOICES.evidence.map(function (name) { return { label: name, count: rows.filter(function (row) { return row.evidence === name; }).length }; }),
      timePairs: pairedTime.length, timeDifferenceMinutes: pairedTime.length ? pairedTime.reduce(function (sum, row) { return sum + row.covenantMinutes - row.baselineMinutes; }, 0) : null,
      defectPairs: pairedDefects.length, defectDifference: pairedDefects.length ? pairedDefects.reduce(function (sum, row) { return sum + row.covenantDefects - row.baselineDefects; }, 0) : null,
      gmvMinor: sumKnown('gmvMinor'), collectedRevenueMinor: sumKnown('collectedRevenueMinor'),
      cashMinor: total('cashMinor'), cashCoverage: known('cashMinor'),
      afterSupportSixtieths: total('afterSupportSixtieths'), supportCoverage: known('afterSupportSixtieths'),
      afterFounderSixtieths: total('afterFounderSixtieths'), fullCoverage: known('afterFounderSixtieths'),
      supportMinutes: sumKnown('supportMinutes'), founderMinutes: sumKnown('founderMinutes') };
  }
  function summarize(input, options) {
    var workbook = validateWorkbook(input, options), w = workbook.window;
    var inWindow = workbook.pilots.filter(function (row) { return row.approachedOn >= w.start && row.approachedOn <= w.end; });
    var permitted = inWindow.filter(function (row) { return row.permission === 'recorded'; });
    return { total: workbook.pilots.length, inWindow: inWindow.length, outsideWindow: workbook.pilots.length - inWindow.length,
      missingPermission: inWindow.length - permitted.length,
      real: measure(permitted.filter(function (row) { return row.kind === 'real'; }), w),
      synthetic: measure(permitted.filter(function (row) { return row.kind === 'synthetic'; }), w) };
  }
  function formatMoney(sixtieths, currency) {
    if (sixtieths === null) return 'UNKNOWN';
    need(Number.isSafeInteger(sixtieths) && Math.abs(sixtieths) <= Number.MAX_SAFE_INTEGER - 30, 'Money total exceeds exact arithmetic limits.');
    need(CURRENCIES.includes(currency), 'Choose one supported asset for money display.');
    var asset = ASSETS[currency];
    var minor = Math.floor((Math.abs(sixtieths) + 30) / 60);
    return asset.label + ' ' + (sixtieths < 0 && minor !== 0 ? '−' : '') + Math.floor(minor / asset.scale) + '.' + String(minor % asset.scale).padStart(asset.digits, '0');
  }
  function sampleWorkbook(on) {
    on = on || today(); var end = day(on);
    function before(days) { return new Date((end - days) * 86400000).toISOString().slice(0, 10); }
    var result = emptyWorkbook(on); result.window.start = before(21);
    var row = defaultPilot();
    Object.assign(row, { id: 'sample-operator', kind: 'synthetic', source: 'direct', assistance: 'assisted', permission: 'recorded', evidence: 'self-reported',
      goal: 'SYNTHETIC: order a small report', baselineProcess: 'SYNTHETIC: email brief, invoice, manual chasing',
      firstJobRef: 'sample-job-one', firstResult: 'accepted', secondJobRef: 'sample-job-two', secondVoluntary: true,
      approachedOn: before(20), agreedOn: before(19), setupOn: before(18), approvedOn: before(17), deliveredOn: before(16), reviewedOn: before(15), reopenedOn: before(8), secondJobOn: before(2),
      offerDecision: 'accepted', offerOn: before(1), baselineComparable: true, baselineMinutes: 60, covenantMinutes: 35, baselineDefects: 2, covenantDefects: 1,
      gmvMinor: 2500, collectedRevenueMinor: 13, providerCostsMinor: 5, partnerCostsMinor: 0, refundDisputeCostsMinor: 0, supportMinutes: 20, supportRateMinorPerHour: 1200, founderMinutes: 10, founderRateMinorPerHour: 3000 });
    var stopped = defaultPilot(); Object.assign(stopped, { id: 'sample-stopped', kind: 'synthetic', permission: 'recorded', evidence: 'self-reported', source: 'community', assistance: 'unknown', goal: 'SYNTHETIC: explore a code review', approachedOn: before(10), abandonedOn: before(9), reason: 'SYNTHETIC: no real supplier available. Costs were not measured.' });
    result.pilots = [row, stopped]; return result;
  }
  // Optional buyer planning. These estimates never enter observed pilot revenue
  // or change the workbook/1 recovery format, and never confer permission.
  var BUYER_NOTE = 'aap-buyer-comparison-note/1';
  var BUYER_COSTS = ['quoteMinor', 'feesMinor', 'reviewMinor', 'coordinationMinor', 'repairLowMinor', 'repairHighMinor'];
  var BUYER_UNITS = ['elapsed-hours', 'business-days'];
  var BUYER_FIELDS = ['label', 'currency', 'acceptance', 'basis', 'delivery', 'timeUnit'].concat(BUYER_COSTS);
  var BUYER_SETTINGS = ['criteria', 'capCurrency', 'capMinor', 'maxDelivery', 'timeUnit'];
  function emptyBuyerComparison() {
    return { criteria: '', capCurrency: 'USD', capMinor: null, maxDelivery: null, timeUnit: 'elapsed-hours', alternatives: [] };
  }
  function defaultBuyerAlternative() {
    var row = { label: '', currency: 'USD', acceptance: 'unknown', basis: '', delivery: null, timeUnit: 'elapsed-hours' };
    BUYER_COSTS.forEach(function (name) { row[name] = null; }); return row;
  }
  function validateBuyerComparison(input) {
    exact(input, BUYER_SETTINGS.concat('alternatives'), 'buyer comparison');
    safeText(input.criteria, 240, 'acceptance criteria');
    need(CURRENCIES.includes(input.capCurrency), 'Choose a supported exact budget asset.');
    need(BUYER_UNITS.includes(input.timeUnit), 'Choose elapsed hours or business days; they are not converted.');
    if (input.capMinor !== null) integer(input.capMinor, ASSETS[input.capCurrency].maxAmount, 'total-cost cap');
    if (input.maxDelivery !== null) integer(input.maxDelivery, 100000, 'delivery limit');
    need(Array.isArray(input.alternatives) && input.alternatives.length <= 8, 'Compare at most eight alternatives.');
    var labels = new Set();
    input.alternatives.forEach(function (row) {
      exact(row, BUYER_FIELDS, 'buyer alternative'); safeText(row.label, 60, 'alternative label'); safeText(row.basis, 240, 'evidence basis');
      need(row.label.trim() === row.label && row.label !== '', 'Give each alternative a short non-empty label without surrounding spaces.');
      var key = row.label.toLowerCase(); need(!labels.has(key), 'Alternative labels must be unique, including letter case.'); labels.add(key);
      need(CURRENCIES.includes(row.currency), 'Choose a supported exact quote asset.');
      need(['meets', 'does-not-meet', 'unknown'].includes(row.acceptance), 'Declare whether the quote addresses your acceptance criteria.');
      need(BUYER_UNITS.includes(row.timeUnit), 'Keep delivery units distinct.');
      if (row.delivery !== null) integer(row.delivery, 100000, 'quoted delivery');
      BUYER_COSTS.forEach(function (name) { if (row[name] !== null) integer(row[name], ASSETS[row.currency].maxAmount, name); });
      need(row.repairLowMinor === null || row.repairHighMinor === null || row.repairLowMinor <= row.repairHighMinor, 'The declared repair range must run from low to high.');
    });
    return clone(input);
  }
  function buyerCost(row) {
    var missing = BUYER_COSTS.filter(function (name) { return row[name] === null; });
    var fixed = ['quoteMinor', 'feesMinor', 'reviewMinor', 'coordinationMinor'];
    var subtotal = fixed.reduce(function (sum, name) { return sum + (row[name] === null ? 0 : row[name]); }, 0);
    // This sum is a lower bound of known components, never a completed total.
    var knownLowerBoundMinor = subtotal + (row.repairLowMinor === null ? 0 : row.repairLowMinor);
    var complete = missing.length === 0;
    return { missing: missing, knownLowerBoundMinor: knownLowerBoundMinor,
      lowMinor: complete ? subtotal + row.repairLowMinor : null,
      highMinor: complete ? subtotal + row.repairHighMinor : null };
  }
  function compareBuyerAlternatives(input) {
    var plan = validateBuyerComparison(input);
    // Canonical label order keeps the same evidence presentation under input
    // permutations. No first row, reputation score or probability breaks ties.
    plan.alternatives.sort(function (a, b) { var x = a.label.toLowerCase(), y = b.label.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
    var rows = plan.alternatives.map(function (row) {
      var cost = buyerCost(row), budget = 'not-set', delivery = 'not-set';
      if (plan.capMinor !== null) {
        if (plan.capCurrency !== row.currency) budget = 'different-asset';
        else if (cost.knownLowerBoundMinor > plan.capMinor) budget = 'over-cap';
        else if (cost.highMinor === null) budget = 'unknown';
        else budget = cost.highMinor <= plan.capMinor ? 'within-declared-range' : 'range-crosses-cap';
      }
      if (plan.maxDelivery !== null) {
        if (plan.timeUnit !== row.timeUnit) delivery = 'different-unit';
        else if (row.delivery === null) delivery = 'unknown';
        else delivery = row.delivery <= plan.maxDelivery ? 'within-declared-limit' : 'over-limit';
      }
      var acceptance = plan.criteria.trim() ? row.acceptance : 'unknown';
      var ruledOut = acceptance === 'does-not-meet' || budget === 'over-cap' || delivery === 'over-limit';
      var unresolved = acceptance === 'unknown' || cost.lowMinor === null || !['not-set', 'within-declared-range'].includes(budget) || !['not-set', 'within-declared-limit'].includes(delivery);
      return { alternative: row, cost: cost, acceptance: acceptance, budget: budget, delivery: delivery,
        check: ruledOut ? 'outside-declared-checks' : unresolved ? 'unresolved' : 'passes-declared-checks' };
    });
    var pairs = [];
    rows.forEach(function (a, i) { rows.slice(i + 1).forEach(function (b) {
      var cost = 'unknown', delivery = 'unknown';
      if (a.alternative.currency !== b.alternative.currency) cost = 'different-assets';
      else if (a.cost.highMinor !== null && b.cost.highMinor !== null) {
        cost = a.cost.highMinor < b.cost.lowMinor ? 'left-lower-throughout' : b.cost.highMinor < a.cost.lowMinor ? 'right-lower-throughout' : 'overlapping-ranges';
      }
      if (a.alternative.timeUnit !== b.alternative.timeUnit) delivery = 'different-units';
      else if (a.alternative.delivery !== null && b.alternative.delivery !== null) delivery = a.alternative.delivery === b.alternative.delivery ? 'same-declared-time' : a.alternative.delivery < b.alternative.delivery ? 'left-sooner' : 'right-sooner';
      pairs.push({ left: a.alternative.label, right: b.alternative.label, cost: cost, delivery: delivery });
    }); });
    return { rows: rows, pairs: pairs, winner: null };
  }
  function buyerComparisonNote(input, label) {
    var plan = validateBuyerComparison(input), selected = plan.alternatives.find(function (row) { return row.label === label; });
    need(!!selected, 'Choose an existing alternative explicitly.');
    var note = { version: BUYER_NOTE, binding: false, execution_authorized: false };
    BUYER_SETTINGS.forEach(function (name) { note[name] = plan[name]; }); note.alternative = selected; return note;
  }
  function validateBuyerComparisonNote(note) {
    exact(note, ['version', 'binding', 'execution_authorized', 'alternative'].concat(BUYER_SETTINGS), 'buyer comparison note');
    need(note.version === BUYER_NOTE && note.binding === false && note.execution_authorized === false, 'Use an unsigned buyer comparison note; it cannot grant authority.');
    var plan = { alternatives: [note.alternative] }; BUYER_SETTINGS.forEach(function (name) { plan[name] = note[name]; }); validateBuyerComparison(plan);
    return clone(note);
  }
  function readBuyerComparisonNote(text) {
    need(typeof text === 'string' && text.length <= 16384 && byteLength(text) <= 16384, 'Choose a buyer comparison note no larger than 16 KiB.');
    return validateBuyerComparisonNote(parseLocalJSON(text, 16384));
  }
  function buyerComparisonDraftFields(input) {
    var note = validateBuyerComparisonNote(input), row = note.alternative;
    var plan = { alternatives: [row] }; BUYER_SETTINGS.forEach(function (name) { plan[name] = note[name]; });
    var report = compareBuyerAlternatives(plan).rows[0], money = function (amount) { return formatMoney(amount === null ? null : amount * 60, row.currency); };
    var details = ['BUYER PLANNING NOTE — NOT AGREED TERMS. This note grants no authority. Reconfirm all proposed terms with the supplier.',
      'Declared acceptance evidence: ' + report.acceptance + '. Basis: ' + (row.basis || 'UNKNOWN') + '.',
      'Buyer-only modeled costs, not supplier payment obligations: fees ' + money(row.feesMinor) + '; review ' + money(row.reviewMinor) + '; coordination ' + money(row.coordinationMinor) + '; repair scenario ' + money(row.repairLowMinor) + ' to ' + money(row.repairHighMinor) + '.',
      'Modeled total range: ' + money(report.cost.lowMinor) + ' to ' + money(report.cost.highMinor) + '. Budget check: ' + report.budget + '. Acceptance/delivery/budget checks: ' + report.check + '.',
      'Buyer total-cost cap: ' + formatMoney(note.capMinor === null ? null : note.capMinor * 60, note.capCurrency) + '; delivery limit: ' + (note.maxDelivery === null ? 'not set' : note.maxDelivery + ' ' + note.timeUnit) + '.',
      'Proposed delivery: ' + (row.delivery === null ? 'UNKNOWN' : row.delivery + ' ' + row.timeUnit) + '. Confirm its starting event and calendar separately.'];
    return { title: row.label, deliverable: note.criteria || 'Acceptance criteria remain to be agreed.', price: row.quoteMinor === null ? 'Exact quoted consideration remains UNKNOWN; agree it before work.' : money(row.quoteMinor) + ' quoted consideration, subject to supplier confirmation.', details: details.join('\n') };
  }
  var api = { VERSION: VERSION, MAX_BYTES: MAX_BYTES, fields: FIELDS.slice(), dates: DATES.slice(), numbers: NUMBERS.slice(),
    emptyWorkbook: emptyWorkbook, defaultPilot: defaultPilot, validateWorkbook: validateWorkbook, parseWorkbook: parseWorkbook,
    serialize: serialize, summarize: summarize, economics: economics, formatMoney: formatMoney, sampleWorkbook: sampleWorkbook,
    buyerCostFields: BUYER_COSTS.slice(), buyerAlternativeFields: BUYER_FIELDS.slice(), emptyBuyerComparison: emptyBuyerComparison,
    defaultBuyerAlternative: defaultBuyerAlternative, validateBuyerComparison: validateBuyerComparison, compareBuyerAlternatives: compareBuyerAlternatives,
    buyerComparisonNote: buyerComparisonNote, readBuyerComparisonNote: readBuyerComparisonNote, buyerComparisonDraftFields: buyerComparisonDraftFields };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.AAPPilotWorkspace = api;
  if (typeof document === 'undefined' || !document.getElementById('pilot-workspace')) return;

  var workbook = emptyWorkbook(), previous = null, editing = null, pending = null, importGeneration = 0;
  var form = document.getElementById('pilot-record-form');
  var status = document.getElementById('workspace-status');
  function el(id) { return document.getElementById(id); }
  function message(text, error) { status.textContent = text; status.setAttribute('role', error ? 'alert' : 'status'); }
  function attempt(action) { try { action(); } catch (error) { message(error && error.message || 'The action was refused. Check the record and try again.', true); } }
  function field(name) { return form.elements.namedItem(name); }
  function setForm(row) {
    FIELDS.forEach(function (name) { var input = field(name); if (BOOLS.includes(name)) input.checked = row[name]; else input.value = row[name] === null ? '' : String(row[name]); });
    field('id').readOnly = editing !== null;
    el('record-form-title').textContent = editing ? 'Edit ' + editing : 'Add one operator and first-order journey';
    el('save-pilot').textContent = editing ? 'Save changes to this tab' : 'Add record to this tab';
  }
  function formRow() {
    var row = defaultPilot();
    FIELDS.forEach(function (name) {
      var input = field(name);
      if (BOOLS.includes(name)) row[name] = input.checked;
      else if (NUMBERS.includes(name)) {
        var value = input.value.trim(); need(value === '' || /^\d+$/.test(value), 'Use whole non-negative minor units, minutes or defects. Leave an unknown amount blank.');
        row[name] = value === '' ? null : Number(value);
      } else row[name] = input.value.trim();
    }); return row;
  }
  function resetForm() { editing = null; setForm(defaultPilot()); field('approachedOn').value = workbook.window.asOf; }
  function invalidateImport() { importGeneration++; pending = null; el('workspace-open-import').hidden = true; el('workspace-import').value = ''; }
  function remember(next) { next = validateWorkbook(next); previous = clone(workbook); workbook = next; invalidateImport(); render(); }
  function element(tag, text) { var node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
  function line(parent, text) { parent.appendChild(element('p', text)); }
  function ratio(count, denominator) { return denominator ? count + ' / ' + denominator : count + ' / 0 (no eligible observations)'; }
  function table(parent, headers, rows) {
    var wrap = element('div'); wrap.className = 'table-wrap'; var grid = element('table'), head = element('thead'), header = element('tr');
    headers.forEach(function (name) { var cell = element('th', name); cell.scope = 'col'; header.appendChild(cell); }); head.appendChild(header); grid.appendChild(head);
    var body = element('tbody'); rows.forEach(function (values) { var row = element('tr'); values.forEach(function (value) { row.appendChild(element('td', String(value))); }); body.appendChild(row); }); grid.appendChild(body); wrap.appendChild(grid); parent.appendChild(wrap);
  }
  function score(parent, title, data) {
    parent.appendChild(element('h3', title + ': ' + data.count + ' eligible records'));
    if (data.count === 0) { line(parent, 'No eligible observations. Outcomes and economics are UNKNOWN; no conversion or repeat rate can be inferred.'); return; }
    table(parent, ['Observed milestone', 'Recorded / cohort', 'Also has preceding milestone / preceding observed', 'Gaps'], data.stages.map(function (row) {
      return [row.label, ratio(row.observed, row.cohortDenominator), ratio(row.transition, row.previousDenominator) + ' (' + row.previous + ')', row.missingPrevious ? row.missingPrevious + ' later records lack the preceding date' : 'None at this transition'];
    }));
    line(parent, 'First jobs with explicit approval, delivery, review and an accepted result: ' + ratio(data.completed, data.count) + '. Voluntary distinct second jobs: ' + ratio(data.repeated, data.repeatDenominator) + ' first completions.');
    line(parent, workbook.window.repeatDays + '-day observation group: ' + ratio(data.matureRepeated, data.matureDenominator) + ' voluntary second jobs among first completions reviewed at least ' + workbook.window.repeatDays + ' days before As of. Early returns remain outside this matured group until eligible.');
    line(parent, 'Second-job dates lacking an explicit first completion: ' + data.missingFirstCompletion + '. Second-job dates without a declared voluntary choice: ' + data.secondNotVoluntary + '. Neither establishes repeated success.');
    line(parent, 'Abandoned: ' + ratio(data.abandoned, data.count) + '. Paid offers accepted: ' + ratio(data.accepted, data.offered) + ' offered. Refused: ' + ratio(data.refused, data.offered) + '. Offer acceptance does not establish payment.');
    line(parent, 'Assistance: ' + data.assistance.map(function (row) { return row.label + ' ' + row.count; }).join('; ') + '. Evidence declared by the recorder: ' + data.evidence.map(function (row) { return row.label + ' ' + row.count; }).join('; ') + '.');
    line(parent, 'Comparable customer administration: ' + ratio(data.timePairs, data.count) + ' paired records; Covenant minus baseline = ' + (data.timeDifferenceMinutes === null ? 'UNKNOWN' : data.timeDifferenceMinutes + ' minutes in total') + '. Defects: ' + ratio(data.defectPairs, data.count) + ' paired records; difference = ' + (data.defectDifference === null ? 'UNKNOWN' : data.defectDifference) + '. Negative means less. These are declared observations, without a causal claim.');
    table(parent, ['Economics for this entire group', 'Amount / coverage'], [
      ['Buyer-to-supplier transaction value (GMV; excluded from revenue)', formatMoney(data.gmvMinor === null ? null : data.gmvMinor * 60, workbook.currency)],
      ['Actual collected Covenant revenue', formatMoney(data.collectedRevenueMinor === null ? null : data.collectedRevenueMinor * 60, workbook.currency)],
      ['Collected revenue − provider costs − partner/incentive costs − refunds/dispute costs', formatMoney(data.cashMinor === null ? null : data.cashMinor * 60, workbook.currency) + '; complete inputs ' + ratio(data.cashCoverage, data.count)],
      ['After allocated support labour at the stated rate', formatMoney(data.afterSupportSixtieths, workbook.currency) + '; complete inputs ' + ratio(data.supportCoverage, data.count)],
      ['After separate imputed founder time', formatMoney(data.afterFounderSixtieths, workbook.currency) + '; complete inputs ' + ratio(data.fullCoverage, data.count)],
      ['Support / founder effort', (data.supportMinutes === null ? 'UNKNOWN' : data.supportMinutes + ' min') + ' / ' + (data.founderMinutes === null ? 'UNKNOWN' : data.founderMinutes + ' min')]
    ]);
  }
  function render() {
    ['start', 'end', 'asOf', 'repeatDays'].forEach(function (name) { el('window-' + name).value = workbook.window[name]; }); el('window-currency').value = workbook.currency;
    el('window-currency').disabled = workbook.pilots.length > 0;
    el('workspace-undo').disabled = previous === null;
    var asset = ASSETS[workbook.currency];
    el('workspace-currency-note').textContent = 'All money and hourly-rate entries use ' + asset.minor + ' (' + asset.scale.toLocaleString('en-GB') + ' minor units per ' + asset.label + '). Blank means UNKNOWN; enter 0 only when confirmed zero. USDC is never treated as USD. Costs incurred in another asset remain UNKNOWN here unless actually measured in this workbook’s asset.';
    NUMBERS.filter(function (name) { return /Minor$/.test(name); }).forEach(function (name) { field(name).max = String(asset.maxAmount); });
    el('workspace-money-limits').textContent = 'At most ' + formatMoney(asset.maxAmount * 60, workbook.currency) + ' per money field; at most ' + formatMoney(1000000000 * 60, workbook.currency) + ' per hour; at most 100,000 minutes per effort field and 100 records per workbook. Combined totals that exceed exact arithmetic limits are refused before saving. Use another workbook for another asset; no conversion is performed.';
    var summary = summarize(workbook), report = el('workspace-scorecard'); report.replaceChildren();
    line(report, 'Cohort approach dates ' + workbook.window.start + ' to ' + workbook.window.end + ', inclusive. Observed through ' + workbook.window.asOf + '. Saved records: ' + summary.total + '; outside this cohort: ' + summary.outsideWindow + '; missing recorded permission in the cohort: ' + summary.missingPermission + ' (excluded from both scorecards).');
    score(report, 'Real activity — user-declared', summary.real); score(report, 'Synthetic exercises — excluded from real activity', summary.synthetic);
    var list = el('workspace-records'); list.replaceChildren();
    if (!workbook.pilots.length) line(list, 'No saved records. Add your first journey below or load the clearly synthetic example.');
    workbook.pilots.forEach(function (row) {
      var item = element('article'); item.className = 'pilot-record'; item.appendChild(element('h3', row.id + ' · ' + row.kind));
      line(item, row.goal); line(item, 'Source: ' + row.source + '; assistance: ' + row.assistance + '; evidence: ' + row.evidence + '; recording permission: ' + row.permission + '.');
      line(item, 'First reference: ' + (row.firstJobRef || 'not supplied') + '; second: ' + (row.secondJobRef || 'not supplied') + '.');
      line(item, 'First job result: ' + row.firstResult + '; paid-offer decision: ' + row.offerDecision + '.');
      line(item, DATES.filter(function (key) { return !!row[key]; }).map(function (key) { return key + ': ' + row[key]; }).join(' · ') || 'No milestones recorded.');
      if (row.reason) line(item, 'Reason / learning: ' + row.reason);
      var actions = element('div'); actions.className = 'actions';
      var edit = element('button', 'Edit record'); edit.type = 'button'; edit.addEventListener('click', function () { editing = row.id; setForm(row); el('record-form-title').scrollIntoView({ block: 'start' }); field('goal').focus(); message('Editing ' + row.id + '. Save changes to retain them in this tab.'); });
      var remove = element('button', 'Remove record'); remove.type = 'button'; remove.addEventListener('click', function () { attempt(function () { var next = clone(workbook); next.pilots = next.pilots.filter(function (candidate) { return candidate.id !== row.id; }); remember(next); if (editing === row.id) resetForm(); message('Removed ' + row.id + '. Undo can restore it. Export again to save the change.'); }); });
      actions.appendChild(edit); actions.appendChild(remove); item.appendChild(actions); list.appendChild(item);
    });
  }
  el('workspace-window-form').addEventListener('submit', function (event) { event.preventDefault(); attempt(function () {
    var next = clone(workbook); next.currency = el('window-currency').value;
    if (workbook.pilots.length && next.currency !== workbook.currency) {
      el('window-currency').value = workbook.currency;
      fail('Keep the exact asset of existing records. Export and start an empty workbook to use another currency or network asset; no conversion is available.');
    }
    ['start', 'end', 'asOf'].forEach(function (name) { next.window[name] = el('window-' + name).value; });
    need(/^\d+$/.test(el('window-repeatDays').value), 'Use 1–90 whole days for repeat observation.'); next.window.repeatDays = Number(el('window-repeatDays').value);
    remember(next); message('Observation window applied. Save records separately; export the workbook to keep it.');
  }); });
  form.addEventListener('submit', function (event) { event.preventDefault(); attempt(function () {
    var row = formRow(), next = clone(workbook);
    if (editing !== null) { var index = next.pilots.findIndex(function (candidate) { return candidate.id === editing; }); need(index >= 0 && row.id === editing, 'The edited record is no longer available. Start a new record.'); next.pilots[index] = row; }
    else next.pilots.push(row);
    remember(next); resetForm(); message('Record saved in this tab. Export the private JSON workbook before leaving.');
  }); });
  el('workspace-new-record').addEventListener('click', function () { resetForm(); message('Started a blank record. Unsaved form edits were discarded; saved records remain.'); });
  el('workspace-undo').addEventListener('click', function () { if (previous !== null) { workbook = previous; previous = null; invalidateImport(); resetForm(); render(); message('Restored the previous saved workbook state in this tab. Export again to keep it.'); } });
  el('workspace-clear').addEventListener('click', function () { remember(emptyWorkbook()); pending = null; el('workspace-open-import').hidden = true; resetForm(); message('Started an empty workbook. Undo restores the previous in-memory workbook. Existing exported files remain on your computer.'); });
  el('workspace-sample').addEventListener('click', function () { attempt(function () { need(!workbook.pilots.length, 'Export and clear the current workbook before loading the example.'); remember(sampleWorkbook()); resetForm(); message('Loaded two clearly SYNTHETIC records. They do not count as real activity or actual revenue.'); }); });
  el('workspace-import').addEventListener('change', function () { var generation = ++importGeneration; pending = null; el('workspace-open-import').hidden = true; var file = this.files && this.files[0]; if (!file) return;
    attempt(function () { need(file.size <= MAX_BYTES, 'Choose a JSON workbook no larger than 256 KiB.');
      file.text().then(function (text) { if (generation !== importGeneration) return; attempt(function () { pending = parseWorkbook(text); el('workspace-open-import').hidden = false; message('Validated selected workbook: ' + pending.pilots.length + ' records, ' + pending.currency + ', As of ' + pending.window.asOf + '. Export the current workbook before replacing it. Click Open selected workbook to load; Undo will restore the previous state.'); }); }).catch(function () { if (generation === importGeneration) message('Could not read the selected file. The current workbook is unchanged.', true); });
    });
  });
  el('workspace-open-import').addEventListener('click', function () { attempt(function () { need(pending !== null, 'Choose and validate a JSON workbook first.'); remember(pending); pending = null; this.hidden = true; resetForm(); message('Opened the selected workbook. Its facts remain user-declared; import does not verify outcomes or payment. Undo restores the previous workbook.'); }.bind(this)); });
  el('workspace-export').addEventListener('click', function () { attempt(function () {
    var output = serialize(workbook); var blob = new Blob([output], { type: 'application/json' }); var url = URL.createObjectURL(blob);
    var link = element('a'); link.href = url; link.download = 'aap-private-pilot-' + workbook.window.asOf + '.json'; document.body.appendChild(link); link.click(); link.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    message('Requested a private JSON download containing only the applied window and saved records. Check the download before closing. Unsaved form edits are excluded. Nothing was sent to Covenant.');
  }); });
  el('workspace-print').addEventListener('click', function () { global.print(); });
  // Independent, optional pre-order scratchpad. No entry becomes a journey,
  // collected revenue, supplier obligation or accepted contract automatically.
  if (el('buyer-comparison-form')) {
    function openBuyerAnchor() { if (global.location && global.location.hash === '#buyer-comparison') el('buyer-comparison').open = true; }
    openBuyerAnchor(); if (typeof global.addEventListener === 'function') global.addEventListener('hashchange', openBuyerAnchor);
    var buyerPlan = emptyBuyerComparison(), buyerEditing = null;
    var buyerLabels = { quoteMinor: 'quote', feesMinor: 'fees', reviewMinor: 'buyer review', coordinationMinor: 'coordination', repairLowMinor: 'repair low', repairHighMinor: 'repair high' };
    var buyerWords = { 'not-set': 'Not set', 'different-asset': 'Different asset — cannot check', 'over-cap': 'Exceeds hard cap', unknown: 'UNKNOWN',
      'within-declared-range': 'Within cap across declared range', 'range-crosses-cap': 'Repair range can exceed cap', 'different-unit': 'Different time unit — cannot check',
      'within-declared-limit': 'Within declared time limit', 'over-limit': 'Exceeds time limit', meets: 'Meets — buyer declaration', 'does-not-meet': 'Does not meet',
      'outside-declared-checks': 'Outside declared checks', unresolved: 'Unresolved', 'passes-declared-checks': 'Passes declared checks — not verified' };
    function buyerMessage(text, error) { el('buyer-comparison-status').textContent = text; el('buyer-comparison-status').setAttribute('role', error ? 'alert' : 'status'); }
    function buyerAttempt(action) { try { action(); } catch (error) { buyerMessage(error && error.message || 'The comparison was refused.', true); } }
    function buyerNumber(id) {
      var raw = el(id).value.trim(); need(raw === '' || /^\d+$/.test(raw), 'Use non-negative whole minor units or time quantities. Blank means UNKNOWN.'); return raw === '' ? null : Number(raw);
    }
    function buyerMoney(minor, currency) { return formatMoney(minor === null ? null : minor * 60, currency); }
    function setBuyerSettings() {
      BUYER_SETTINGS.forEach(function (key) { el('buyer-' + key).value = buyerPlan[key] === null ? '' : String(buyerPlan[key]); });
      el('buyer-capMinor').max = String(ASSETS[buyerPlan.capCurrency].maxAmount);
    }
    function setBuyerRow(row) {
      BUYER_FIELDS.forEach(function (key) { el('alternative-' + key).value = row[key] === null ? '' : String(row[key]); });
      updateBuyerAsset(); el('buyer-save-alternative').textContent = buyerEditing === null ? 'Add alternative to this tab' : 'Save alternative changes';
    }
    function resetBuyerRow() { buyerEditing = null; var row = defaultBuyerAlternative(); row.currency = buyerPlan.capCurrency; row.timeUnit = buyerPlan.timeUnit; setBuyerRow(row); }
    function updateBuyerAsset() {
      var asset = ASSETS[el('alternative-currency').value]; if (!asset) return;
      BUYER_COSTS.forEach(function (key) { el('alternative-' + key).max = String(asset.maxAmount); });
      el('buyer-alternative-units').textContent = 'Every amount below is in whole ' + asset.minor + '. Maximum ' + asset.maxAmount + ' per amount. Blank means UNKNOWN; enter 0 only for an explicitly assumed zero. Changing the asset does not convert existing numbers.';
    }
    function renderBuyerComparison() {
      var report = compareBuyerAlternatives(buyerPlan), target = el('buyer-comparison-results'); target.replaceChildren();
      line(target, 'Applied acceptance criteria: ' + (buyerPlan.criteria || 'UNKNOWN — set the useful result and how you will check it') + '. Total-cost cap: ' + (buyerPlan.capMinor === null ? 'not set' : buyerMoney(buyerPlan.capMinor, buyerPlan.capCurrency)) + '. Delivery limit: ' + (buyerPlan.maxDelivery === null ? 'not set' : buyerPlan.maxDelivery + ' ' + buyerPlan.timeUnit) + '.');
      if (!report.rows.length) { line(target, 'No alternatives added. The ordinary first-order workbook works without this optional comparison.'); return; }
      report.rows.forEach(function (entry) {
        var row = entry.alternative, cost = entry.cost, item = element('article'); item.className = 'pilot-record';
        item.appendChild(element('h3', row.label + ' · ' + buyerWords[entry.check]));
        table(item, ['Buyer-declared component', 'Amount or check'], [
          ['Quoted supplier price', buyerMoney(row.quoteMinor, row.currency)],
          ['Additional fees / buyer review / coordination', [row.feesMinor, row.reviewMinor, row.coordinationMinor].map(function (n) { return buyerMoney(n, row.currency); }).join(' / ')],
          ['Repair scenario low to high (not a probability forecast)', buyerMoney(row.repairLowMinor, row.currency) + ' to ' + buyerMoney(row.repairHighMinor, row.currency)],
          ['Modeled total: quote + fees + review + coordination + repair', buyerMoney(cost.lowMinor, row.currency) + ' to ' + buyerMoney(cost.highMinor, row.currency)],
          ['Hard total-cost cap', buyerWords[entry.budget]],
          ['Acceptance criteria', buyerWords[entry.acceptance]],
          ['Quoted delivery / limit check', (row.delivery === null ? 'UNKNOWN' : row.delivery + ' ' + row.timeUnit) + ' / ' + buyerWords[entry.delivery]]
        ]);
        if (cost.missing.length) line(item, 'Missing: ' + cost.missing.map(function (key) { return buyerLabels[key]; }).join(', ') + '. Complete total stays UNKNOWN. Known components provide only a lower bound of ' + buyerMoney(cost.knownLowerBoundMinor, row.currency) + '; missing amounts are not treated as free.');
        line(item, 'Evidence basis, supplied by buyer: ' + (row.basis || 'UNKNOWN') + '. This is not delivery verification.');
        var actions = element('div'); actions.className = 'actions';
        var edit = element('button', 'Edit ' + row.label); edit.type = 'button'; edit.addEventListener('click', function () { buyerEditing = row.label; setBuyerRow(row); el('alternative-label').focus(); buyerMessage('Editing ' + row.label + '. Save changes to update this comparison.'); }); actions.appendChild(edit);
        var remove = element('button', 'Remove ' + row.label); remove.type = 'button'; remove.addEventListener('click', function () { buyerPlan.alternatives = buyerPlan.alternatives.filter(function (value) { return value.label !== row.label; }); if (buyerEditing === row.label) resetBuyerRow(); renderBuyerComparison(); buyerMessage('Alternative removed from this tab.'); }); actions.appendChild(remove);
        var download = element('button', 'Choose ' + row.label + ' for draft review'); download.type = 'button'; download.addEventListener('click', function () { buyerAttempt(function () {
          var note = buyerComparisonNote(buyerPlan, row.label), blob = new Blob([JSON.stringify(note) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob), link = element('a');
          link.href = url; link.download = 'aap-buyer-comparison-note.json'; document.body.appendChild(link); link.click(); link.remove(); global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          buyerMessage('Requested an unsigned note for ' + row.label + '. ' + buyerWords[entry.check] + '. Open Matrix, choose this note, and review its editable proposed terms. This is not approval or acceptance.');
        }); }); actions.appendChild(download); item.appendChild(actions); target.appendChild(item);
      });
      if (report.pairs.length) {
        var pairWords = { 'left-lower-throughout': 'First has lower modeled cost throughout the declared repair ranges', 'right-lower-throughout': 'Second has lower modeled cost throughout the declared repair ranges', 'overlapping-ranges': 'Cost ranges overlap or touch; no strict cost order', 'different-assets': 'Different assets; no cost order', unknown: 'UNKNOWN; complete costs or delivery are missing', 'different-units': 'Different time units; no delivery order', 'same-declared-time': 'Same declared delivery quantity', 'left-sooner': 'First declares earlier delivery', 'right-sooner': 'Second declares earlier delivery' };
        target.appendChild(element('h3', 'Compare tradeoffs, then make your own choice'));
        table(target, ['First / second (label order)', 'Cost range comparison', 'Delivery comparison'], report.pairs.map(function (pair) { return [pair.left + ' / ' + pair.right, pairWords[pair.cost], pairWords[pair.delivery]]; }));
      }
      line(target, 'No winner is selected. Label order is stable when entry order changes. A lower modeled cost does not overcome a failed acceptance check or hard cap. Ranges are your scenarios, not guarantees, calibrated probabilities or a market-matching proof. Keeping no deal remains an option.');
    }
    el('buyer-settings-form').addEventListener('submit', function (event) { event.preventDefault(); buyerAttempt(function () {
      var next = clone(buyerPlan); next.criteria = el('buyer-criteria').value.trim(); next.capCurrency = el('buyer-capCurrency').value; next.capMinor = buyerNumber('buyer-capMinor'); next.maxDelivery = buyerNumber('buyer-maxDelivery'); next.timeUnit = el('buyer-timeUnit').value;
      var changed = next.criteria !== buyerPlan.criteria;
      if (changed) next.alternatives.forEach(function (row) { row.acceptance = 'unknown'; });
      buyerPlan = validateBuyerComparison(next);
      if (changed) el('alternative-acceptance').value = 'unknown';
      setBuyerSettings(); renderBuyerComparison(); buyerMessage('Buyer checks applied in this tab.' + (changed ? ' Acceptance criteria changed; reassess every alternative. Prior acceptance declarations were reset to UNKNOWN.' : '') + ' Existing amounts and time units were not converted.');
    }); });
    el('buyer-comparison-form').addEventListener('submit', function (event) { event.preventDefault(); buyerAttempt(function () {
      var row = defaultBuyerAlternative(); BUYER_FIELDS.forEach(function (key) { row[key] = BUYER_COSTS.includes(key) || key === 'delivery' ? buyerNumber('alternative-' + key) : el('alternative-' + key).value.trim(); });
      var next = clone(buyerPlan);
      if (buyerEditing !== null) { var index = next.alternatives.findIndex(function (value) { return value.label === buyerEditing; }); need(index >= 0, 'The edited alternative is no longer available.'); next.alternatives[index] = row; } else next.alternatives.push(row);
      buyerPlan = validateBuyerComparison(next); resetBuyerRow(); renderBuyerComparison(); buyerMessage('Alternative saved in this tab. Choose a saved alternative to export its unsigned draft note. Pilot workbook exports exclude this separate planning comparison.');
    }); });
    el('alternative-currency').addEventListener('change', updateBuyerAsset);
    el('buyer-capCurrency').addEventListener('change', function () { var asset = ASSETS[this.value]; if (asset) el('buyer-capMinor').max = String(asset.maxAmount); });
    el('buyer-new-alternative').addEventListener('click', function () { resetBuyerRow(); buyerMessage('Started a blank alternative. Saved comparison entries remain.'); });
    el('buyer-clear-comparison').addEventListener('click', function () { buyerPlan = emptyBuyerComparison(); setBuyerSettings(); resetBuyerRow(); renderBuyerComparison(); buyerMessage('Optional comparison cleared. Pilot workbook records are unchanged.'); });
    el('buyer-sample-comparison').addEventListener('click', function () { buyerAttempt(function () {
      need(buyerPlan.alternatives.length === 0, 'Clear the optional comparison before loading its fictional example.');
      buyerPlan = emptyBuyerComparison(); Object.assign(buyerPlan, { criteria: 'SYNTHETIC: one two-page report with linked sources and a buyer review.', capMinor: 12000, maxDelivery: 8 });
      var alpha = defaultBuyerAlternative(), beta = defaultBuyerAlternative();
      Object.assign(alpha, { label: 'SYNTHETIC Alpha', acceptance: 'meets', basis: 'Fictional scope reviewed; quality not verified', delivery: 4, quoteMinor: 6000, feesMinor: 500, reviewMinor: 2000, coordinationMinor: 1500, repairLowMinor: 1000, repairHighMinor: 4000 });
      Object.assign(beta, { label: 'SYNTHETIC Beta', acceptance: 'meets', basis: 'Fictional scope reviewed; quality not verified', delivery: 8, quoteMinor: 8000, feesMinor: 500, reviewMinor: 500, coordinationMinor: 500, repairLowMinor: 0, repairHighMinor: 1000 });
      buyerPlan.alternatives = [alpha, beta]; setBuyerSettings(); resetBuyerRow(); renderBuyerComparison(); buyerMessage('Loaded fictional comparison only. The lower quote can exceed the cap after review, coordination and repairs. No real supplier or payment is involved.');
    }); });
    setBuyerSettings(); resetBuyerRow(); renderBuyerComparison();
  }
  resetForm(); render();
})(typeof window === 'undefined' ? globalThis : window);
