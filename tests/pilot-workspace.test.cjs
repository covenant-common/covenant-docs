const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pilot = require('../assets/pilot-workspace.js');
const OPTIONS = { today: '2026-10-31' };
const copy = value => JSON.parse(JSON.stringify(value));
const summary = workbook => pilot.summarize(workbook, OPTIONS);
const validate = workbook => pilot.validateWorkbook(workbook, OPTIONS);
function realWorkbook() {
  const book = pilot.sampleWorkbook(OPTIONS.today);
  book.pilots = [book.pilots[0]];
  book.pilots[0].kind = 'real';
  return book;
}

test('private export/import round-trips saved facts and keeps real and synthetic cohorts separate', () => {
  const book = realWorkbook();
  const synthetic = pilot.sampleWorkbook(OPTIONS.today).pilots[1];
  book.pilots.push(synthetic);
  const json = pilot.serialize(book, OPTIONS);
  assert.deepEqual(pilot.parseWorkbook(json, OPTIONS), book);
  const report = summary(book);
  assert.equal(report.real.count, 1);
  assert.equal(report.synthetic.count, 1);
  assert.equal(report.real.completed, 1);
  assert.equal(report.synthetic.completed, 0);
  assert.equal(report.synthetic.cashMinor, null);
  assert.equal(report.real.repeated, 1);
  assert.equal(report.real.matureRepeated, 1);
  assert.equal(report.real.matureDenominator, 1);
  assert.equal(report.real.assistance.find(row => row.label === 'assisted').count, 1);
});

test('completion requires approved, delivered, reviewed and accepted; correction and dispute never become success', () => {
  for (const result of ['unknown', 'correction-needed', 'disputed']) {
    const book = realWorkbook(); book.pilots[0].firstResult = result;
    const report = summary(book).real;
    assert.equal(report.completed, 0, result);
    assert.equal(report.stages.find(row => row.label === 'First job reviewed').observed, 1);
    assert.equal(report.repeated, 0);
    assert.equal(report.repeatDenominator, 0);
    assert.equal(report.matureDenominator, 0);
    assert.equal(report.missingFirstCompletion, 1);
  }
  for (const missing of ['approvedOn', 'deliveredOn', 'reviewedOn']) {
    const book = realWorkbook(); book.pilots[0][missing] = '';
    assert.equal(summary(book).real.completed, 0, missing);
  }
});

test('reopening and second-job activity cannot invent missing milestones, voluntary choice or payment', () => {
  const book = realWorkbook(); const row = book.pilots[0];
  row.approvedOn = ''; row.deliveredOn = ''; row.reviewedOn = '';
  row.collectedRevenueMinor = null;
  const report = summary(book).real;
  assert.equal(report.stages.find(stage => stage.label === 'First record reopened').observed, 1);
  assert.equal(report.stages.find(stage => stage.label === 'First record reopened').missingPrevious, 1);
  assert.equal(report.stages.find(stage => stage.label === 'First record reopened').transition, 0);
  assert.equal(report.completed, 0);
  assert.equal(report.repeated, 0);
  assert.equal(report.collectedRevenueMinor, null);
  assert.equal(report.accepted, 1); // Accepted offer stays distinct from collection.
  const other = realWorkbook(); other.pilots[0].secondVoluntary = false;
  assert.equal(summary(other).real.repeated, 0);
  assert.equal(summary(other).real.secondNotVoluntary, 1);
  assert.equal(summary(other).real.repeatDenominator, 1);
});

test('mature repeat denominator uses a stated observation window and does not turn early returns into matured evidence', () => {
  const book = realWorkbook(); const row = book.pilots[0];
  row.reviewedOn = '2026-10-29'; row.reopenedOn = '2026-10-30'; row.secondJobOn = '2026-10-31';
  const report = summary(book).real;
  assert.equal(report.repeated, 1);
  assert.equal(report.repeatDenominator, 1);
  assert.equal(report.matureRepeated, 0);
  assert.equal(report.matureDenominator, 0);
});

test('cohort exclusions, permission and non-adopters remain visible with explicit denominators', () => {
  const book = pilot.sampleWorkbook(OPTIONS.today);
  book.pilots.forEach(row => { row.kind = 'real'; });
  let report = summary(book);
  assert.equal(report.real.count, 2);
  assert.equal(report.real.abandoned, 1);
  assert.equal(report.real.stages[1].observed, 1);
  assert.equal(report.real.stages[1].cohortDenominator, 2);
  assert.equal(report.real.stages[1].previousDenominator, 2);
  book.pilots[1].permission = 'not-recorded';
  report = summary(book);
  assert.equal(report.missingPermission, 1);
  assert.equal(report.real.count, 1);
  book.window.start = '2026-10-15';
  report = summary(book);
  assert.equal(report.outsideWindow, 1);
  assert.equal(report.missingPermission, 1);
  assert.equal(report.real.count, 0);
  assert.equal(report.real.cashMinor, null);
});

test('exact collected contribution excludes GMV and retains fractional support cost until final display', () => {
  const book = realWorkbook(); const row = book.pilots[0];
  Object.assign(row, { gmvMinor: 900000000, collectedRevenueMinor: 1000, providerCostsMinor: 100,
    partnerCostsMinor: 50, refundDisputeCostsMinor: 25, supportMinutes: 1,
    supportRateMinorPerHour: 100, founderMinutes: 1, founderRateMinorPerHour: 50 });
  const costs = pilot.economics(row);
  assert.equal(costs.cashMinor, 825);
  assert.equal(costs.afterSupportSixtieths, 49400);
  assert.equal(costs.afterFounderSixtieths, 49350);
  assert.equal(pilot.formatMoney(costs.afterSupportSixtieths, 'USD'), 'USD 8.23');
  assert.equal(pilot.formatMoney(costs.afterFounderSixtieths, 'USD'), 'USD 8.23');
  assert.equal(pilot.formatMoney(-30, 'GBP'), 'GBP −0.01');
  assert.equal(pilot.formatMoney(30, 'EUR'), 'EUR 0.01');
  assert.equal(summary(book).real.cashMinor, 825);
  assert.equal(summary(book).real.gmvMinor, 900000000);
});

test('USDC network assets retain a 0.125 fee exactly without a fiat peg or conversion', () => {
  for (const asset of ['USDC_BASE', 'USDC_ETHEREUM']) {
    const book = realWorkbook(); book.currency = asset;
    Object.assign(book.pilots[0], { gmvMinor: 25000000, collectedRevenueMinor: 125000,
      providerCostsMinor: 0, partnerCostsMinor: 0, refundDisputeCostsMinor: 0,
      supportMinutes: 60, supportRateMinorPerHour: 50000000, founderMinutes: 0, founderRateMinorPerHour: 0 });
    const exported = pilot.serialize(book, OPTIONS), recovered = pilot.parseWorkbook(exported, OPTIONS);
    assert.equal(recovered.currency, asset);
    assert.equal(recovered.pilots[0].collectedRevenueMinor, 125000);
    const result = summary(recovered).real;
    assert.equal(pilot.formatMoney(result.collectedRevenueMinor * 60, asset), asset + ' 0.125000');
    assert.equal(pilot.formatMoney(result.gmvMinor * 60, asset), asset + ' 25.000000');
    assert.equal(pilot.formatMoney(result.afterSupportSixtieths, asset), asset + ' −49.875000');
    recovered.pilots[0].providerCostsMinor = null; // Fiat cost has no adopted conversion into this asset.
    assert.equal(summary(recovered).real.cashMinor, null);
    assert.equal(summary(recovered).real.afterSupportSixtieths, null);
    recovered.pilots[0].currency = 'USD';
    assert.throws(() => validate(recovered), /Unexpected/); // Per-row assets cannot be mixed.
  }
  assert.equal(pilot.formatMoney(125000 * 60, 'USD'), 'USD 1250.00');
});

test('USDC amount limits cover an actual 7200 deployment receipt while fiat limits remain unchanged', () => {
  for (const asset of ['USDC_BASE', 'USDC_ETHEREUM']) {
    const book = realWorkbook(); book.currency = asset;
    Object.assign(book.pilots[0], { collectedRevenueMinor: 7200000000, gmvMinor: 0,
      providerCostsMinor: 0, partnerCostsMinor: 0, refundDisputeCostsMinor: 0,
      supportMinutes: 60, supportRateMinorPerHour: 50000000, founderMinutes: 0, founderRateMinorPerHour: 0 });
    const recovered = pilot.parseWorkbook(pilot.serialize(book, OPTIONS), OPTIONS);
    assert.equal(recovered.pilots[0].collectedRevenueMinor, 7200000000);
    const result = summary(recovered).real;
    assert.equal(pilot.formatMoney(result.cashMinor * 60, asset), asset + ' 7200.000000');
    assert.equal(pilot.formatMoney(result.afterSupportSixtieths, asset), asset + ' 7150.000000');
    recovered.currency = 'USD';
    assert.throws(() => validate(recovered), /whole number within the limit/);
  }
});

test('missing costs or rates stay UNKNOWN; a confirmed zero remains a known zero', () => {
  const book = realWorkbook(); const row = book.pilots[0];
  row.providerCostsMinor = null;
  let report = summary(book).real;
  assert.equal(report.collectedRevenueMinor, 13);
  assert.equal(report.cashMinor, null);
  assert.equal(report.cashCoverage, 0);
  assert.equal(report.afterSupportSixtieths, null);
  row.providerCostsMinor = 0; row.supportRateMinorPerHour = null;
  report = summary(book).real;
  assert.equal(report.cashMinor, 13);
  assert.equal(report.afterSupportSixtieths, null);
  row.supportMinutes = 0; row.supportRateMinorPerHour = 0;
  assert.equal(summary(book).real.afterSupportSixtieths, 13 * 60);
  row.founderRateMinorPerHour = null;
  assert.equal(summary(book).real.afterFounderSixtieths, null);
  row.collectedRevenueMinor = 0;
  assert.equal(summary(book).real.collectedRevenueMinor, 0);
  assert.equal(pilot.formatMoney(null, 'USD'), 'UNKNOWN');
});

test('incomplete rows keep whole-group economics unknown rather than silently using only favourable rows', () => {
  const book = pilot.sampleWorkbook(OPTIONS.today);
  book.pilots.forEach(row => { row.kind = 'real'; });
  const report = summary(book).real;
  assert.equal(report.cashMinor, null);
  assert.equal(report.cashCoverage, 1);
  assert.equal(report.count, 2);
  assert.equal(report.afterFounderSixtieths, null);
  assert.equal(report.fullCoverage, 1);
  assert.equal(report.gmvMinor, null);
});

test('maximum bounded aggregate keeps exact safe-integer arithmetic', () => {
  const book = realWorkbook(); const original = copy(book.pilots[0]); book.pilots = [];
  for (let i = 0; i < 100; i++) {
    const row = copy(original);
    Object.assign(row, { id: 'operator-' + i, firstJobRef: 'first-' + i, secondJobRef: 'second-' + i,
      collectedRevenueMinor: 1000000000, providerCostsMinor: 1000000000, partnerCostsMinor: 1000000000,
      refundDisputeCostsMinor: 1000000000, supportMinutes: 100000, supportRateMinorPerHour: 10000000,
      founderMinutes: 100000, founderRateMinorPerHour: 10000000 });
    book.pilots.push(row);
  }
  const report = summary(book).real;
  assert.equal(report.cashMinor, -200000000000);
  assert.equal(report.afterFounderSixtieths, -212000000000000);
  assert.ok(Number.isSafeInteger(report.afterFounderSixtieths));
  const exported = pilot.serialize(book, OPTIONS);
  assert.ok(Buffer.byteLength(exported) <= pilot.MAX_BYTES);
  assert.equal(pilot.parseWorkbook(exported, OPTIONS).pilots.length, 100);
});

test('rejects duplicate operator and job aliases, including across synthetic and real records', () => {
  for (const mutation of [
    rows => { rows[1].id = rows[0].id.toUpperCase(); },
    rows => { rows[1].firstJobRef = rows[0].firstJobRef.toUpperCase(); },
    rows => { rows[0].secondJobRef = rows[0].firstJobRef; }
  ]) {
    const book = pilot.sampleWorkbook(OPTIONS.today); mutation(book.pilots);
    assert.throws(() => validate(book), /unique|only once/);
  }
});

test('rejects hostile structures, duplicate JSON fields, unsafe numbers, secrets and oversized UTF-8 imports', () => {
  const book = realWorkbook(); const valid = pilot.serialize(book, OPTIONS);
  assert.throws(() => pilot.parseWorkbook(valid.replace('"currency":"USD"', '"currency":"USD","currency":"GBP"'), OPTIONS), /Duplicate JSON/);
  assert.throws(() => pilot.parseWorkbook(valid.replace('"currency":"USD"', '"currency":"USD","curr\\u0065ncy":"GBP"'), OPTIONS), /Duplicate JSON/);
  assert.throws(() => pilot.parseWorkbook(valid.replace('"baselineMinutes":60', '"baselineMinutes":1e400'), OPTIONS), /finite safe/);
  for (const number of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER, -0]) {
    const wrong = copy(book); wrong.pilots[0].supportMinutes = number;
    assert.throws(() => validate(wrong), /whole number/);
  }
  const wrong = copy(book); wrong.pilots[0].goal = 'private_key: secret';
  assert.throws(() => validate(wrong), /Remove keys/);
  for (const marker of ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----', '-----BEGIN OPENSSH PRIVATE KEY-----', '-----BEGIN ENCRYPTED PRIVATE KEY-----', '-----BEGIN PGP PRIVATE KEY BLOCK-----']) {
    const pasted = copy(book); pasted.pilots[0].goal = marker;
    assert.throws(() => validate(pasted), /Remove keys/, marker);
  }
  const extra = copy(book); extra.pilots[0].private_seed = 'hidden';
  assert.throws(() => validate(extra), /Unexpected/);
  assert.throws(() => pilot.parseWorkbook('{"__proto__":{"polluted":true}}', OPTIONS), /Unexpected/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => pilot.parseWorkbook('"' + 'é'.repeat(140000) + '"', OPTIONS), /256 KiB/);
  assert.throws(() => pilot.parseWorkbook('['.repeat(14) + '0' + ']'.repeat(14), OPTIONS), /nesting/);
  assert.throws(() => pilot.parseWorkbook(valid + ' false', OPTIONS), /Unexpected text/);
});

test('refuses impossible calendar/future claims and inconsistent offer or first-job dates', () => {
  for (const mutation of [
    book => { book.window.asOf = '2026-11-01'; },
    book => { book.window.start = '2026-11-01'; },
    book => { book.pilots[0].approvedOn = '2026-02-30'; },
    book => { book.pilots[0].secondJobOn = '2026-11-01'; },
    book => { book.pilots[0].approvedOn = '2026-10-20'; },
    book => { book.pilots[0].offerOn = ''; },
    book => { book.pilots[0].firstJobRef = ''; }
  ]) {
    const book = realWorkbook(); mutation(book);
    assert.throws(() => validate(book));
  }
  const book = realWorkbook(); book.currency = 'JPY';
  assert.throws(() => validate(book), /USD, GBP, EUR/);
});

function browserRig() {
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.handlers = {}; this.attributes = {}; this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.files = []; this._text = ''; }
    set textContent(text) { this._text = String(text); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { throw new Error('Unsafe HTML rendering'); }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    click() { if (this.handlers.click) return this.handlers.click.call(this, { preventDefault() {} }); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    scrollIntoView() {}
    focus() {}
  }
  const nodes = new Map(), fields = new Map(), effects = [], blobs = [], revoked = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  pilot.fields.forEach(name => fields.set(name, new Element('input')));
  get('pilot-record-form').elements = { namedItem: name => fields.get(name) };
  const TestURL = class extends URL {};
  TestURL.createObjectURL = blob => { blobs.push(blob); return 'blob:private-test-' + blobs.length; };
  TestURL.revokeObjectURL = url => { revoked.push(url); };
  const document = { getElementById: get, createElement: tag => new Element(tag), body: new Element('body') };
  const context = { document, URL: TestURL, Blob, TextEncoder, Date, setTimeout(fn) { fn(); }, print() { effects.push('print'); },
    fetch() { effects.push('network'); throw new Error('Unexpected network access'); },
    localStorage: { setItem() { effects.push('storage'); throw new Error('Unexpected storage'); }, getItem() { throw new Error('Unexpected storage'); } },
    sessionStorage: { setItem() { throw new Error('Unexpected storage'); }, getItem() { throw new Error('Unexpected storage'); } } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../assets/pilot-workspace.js'), 'utf8'), context);
  function fill(row) { pilot.fields.forEach(name => { const field = fields.get(name); if (typeof row[name] === 'boolean') field.checked = row[name]; else field.value = row[name] === null ? '' : String(row[name]); }); }
  function submit(id) { get(id).handlers.submit({ preventDefault() {} }); }
  function select(textOrPromise) {
    get('workspace-import').files = [{ size: typeof textOrPromise === 'string' ? Buffer.byteLength(textOrPromise) : 1000, text: () => Promise.resolve(textOrPromise) }];
    get('workspace-import').handlers.change.call(get('workspace-import'));
  }
  return { get, fields, effects, blobs, revoked, fill, submit, select, context };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('actual DOM handlers save, export, clear, reopen and undo private records without network or storage', async () => {
  const rig = browserRig();
  rig.get('workspace-sample').click();
  assert.match(rig.get('workspace-records').textContent, /sample-operator/);
  rig.get('workspace-export').click();
  assert.equal(rig.blobs.length, 1);
  const exported = await rig.blobs[0].text();
  assert.equal(pilot.parseWorkbook(exported).pilots.length, 2);
  assert.equal(rig.revoked.length, 1);
  rig.get('workspace-clear').click();
  assert.match(rig.get('workspace-records').textContent, /No saved records/);
  rig.select(exported); await flush();
  assert.equal(rig.get('workspace-open-import').hidden, false);
  assert.match(rig.get('workspace-records').textContent, /No saved records/); // Selection alone never replaces data.
  rig.get('workspace-open-import').click();
  assert.match(rig.get('workspace-records').textContent, /sample-operator/);
  rig.get('workspace-undo').click();
  assert.match(rig.get('workspace-records').textContent, /No saved records/);
  assert.deepEqual(rig.effects, []);
});

test('real form handlers preserve unknowns and render imported markup as inert text', async () => {
  const rig = browserRig(); const on = rig.context.AAPPilotWorkspace.emptyWorkbook().window.asOf;
  const row = pilot.defaultPilot(); Object.assign(row, { id: 'operator-one', goal: '<img src=x onerror=alert(1)>', approachedOn: on, permission: 'recorded', kind: 'real', evidence: 'self-reported' });
  rig.fill(row); rig.submit('pilot-record-form');
  assert.match(rig.get('workspace-records').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(rig.get('workspace-scorecard').textContent, /UNKNOWN/);
  rig.get('workspace-export').click();
  const book = pilot.parseWorkbook(await rig.blobs[0].text());
  assert.equal(book.pilots[0].collectedRevenueMinor, null);
  assert.equal(book.pilots[0].approvedOn, '');
  assert.equal(book.pilots[0].firstResult, 'unknown');
  const correction = pilot.defaultPilot();
  Object.assign(correction, { id: 'correction-operator', goal: 'One report needs correction', approachedOn: on,
    permission: 'recorded', firstJobRef: 'correction-job', approvedOn: on, deliveredOn: on,
    reviewedOn: on, firstResult: 'correction-needed', offerDecision: 'refused', offerOn: on });
  rig.fill(correction); rig.submit('pilot-record-form');
  assert.match(rig.get('workspace-records').textContent, /First job result: correction-needed; paid-offer decision: refused/);
  assert.match(rig.get('workspace-records').textContent, /First job result: unknown; paid-offer decision: not-offered/);
  assert.deepEqual(rig.effects, []);
});

test('invalid import leaves saved data untouched and cannot leave an earlier pending import available', async () => {
  const rig = browserRig(); const valid = pilot.serialize(pilot.sampleWorkbook());
  rig.get('workspace-sample').click();
  rig.select(valid); await flush();
  assert.equal(rig.get('workspace-open-import').hidden, false);
  rig.select('{"version":"wrong"}'); await flush();
  assert.equal(rig.get('workspace-open-import').hidden, true);
  assert.match(rig.get('workspace-records').textContent, /sample-operator/);
  assert.equal(rig.get('workspace-status').attributes.role, 'alert');
});

test('selected USDC asset labels and six-decimal results render, and existing records lock the asset', async () => {
  const rig = browserRig(); const on = pilot.emptyWorkbook().window.asOf;
  rig.get('window-currency').value = 'USDC_BASE'; rig.submit('workspace-window-form');
  assert.match(rig.get('workspace-currency-note').textContent, /micro-units on Base/);
  assert.match(rig.get('workspace-money-limits').textContent, /USDC_BASE 1000000\.000000 per money field; at most USDC_BASE 1000\.000000 per hour/);
  assert.equal(rig.fields.get('collectedRevenueMinor').max, '1000000000000');
  const row = pilot.defaultPilot(); Object.assign(row, { id: 'usdc-operator', goal: 'One declared USDC report',
    approachedOn: on, permission: 'recorded', collectedRevenueMinor: 125000, gmvMinor: 25000000 });
  rig.fill(row); rig.submit('pilot-record-form');
  assert.match(rig.get('workspace-scorecard').textContent, /USDC_BASE 0\.125000/);
  assert.match(rig.get('workspace-scorecard').textContent, /UNKNOWN/);
  assert.equal(rig.get('window-currency').disabled, true);
  rig.get('window-currency').value = 'USDC_ETHEREUM'; rig.submit('workspace-window-form');
  assert.match(rig.get('workspace-status').textContent, /Keep the exact asset/);
  assert.equal(rig.get('window-currency').value, 'USDC_BASE');
  rig.get('workspace-export').click();
  assert.equal(pilot.parseWorkbook(await rig.blobs[0].text()).currency, 'USDC_BASE');
});

test('combined exact-arithmetic overflow is refused before a saved workbook can mutate', async () => {
  const book = pilot.sampleWorkbook(); book.pilots = [book.pilots[0]]; book.currency = 'USDC_BASE';
  const original = copy(book.pilots[0]); book.pilots = [];
  for (let i = 0; i < 45; i++) {
    const row = copy(original); Object.assign(row, { id: 'large-' + i, firstJobRef: 'large-first-' + i,
      secondJobRef: 'large-second-' + i, supportMinutes: 100000, supportRateMinorPerHour: 1000000000,
      founderMinutes: 100000, founderRateMinorPerHour: 1000000000 }); book.pilots.push(row);
  }
  const valid = pilot.serialize(book);
  const extra = copy(book.pilots[0]); Object.assign(extra, { id: 'large-overflow', firstJobRef: 'overflow-first', secondJobRef: 'overflow-second' });
  const excessive = copy(book); excessive.pilots.push(extra);
  assert.throws(() => pilot.validateWorkbook(excessive), /exact arithmetic limits/);
  assert.throws(() => pilot.parseWorkbook(JSON.stringify(excessive)), /exact arithmetic limits/);
  const rig = browserRig(); rig.select(valid); await flush(); rig.get('workspace-open-import').click();
  rig.fill(extra); rig.submit('pilot-record-form');
  assert.match(rig.get('workspace-status').textContent, /exact arithmetic limits/);
  rig.get('workspace-export').click();
  const retained = pilot.parseWorkbook(await rig.blobs[0].text());
  assert.equal(retained.pilots.length, 45);
  assert.equal(retained.pilots.some(row => row.id === 'large-overflow'), false);
  assert.deepEqual(rig.effects, []);
});

test('deferred file reads cannot replace a newer selection or revive pending imports after clear, undo or sample', async () => {
  const fileA = pilot.serialize(pilot.sampleWorkbook());
  const empty = pilot.emptyWorkbook(); empty.currency = 'GBP'; const fileB = pilot.serialize(empty);
  const rig = browserRig(); let releaseA;
  rig.select(new Promise(resolve => { releaseA = resolve; }));
  rig.select(fileB); await flush();
  releaseA(fileA); await flush();
  rig.get('workspace-open-import').click();
  rig.get('workspace-export').click();
  assert.equal(pilot.parseWorkbook(await rig.blobs[0].text()).currency, 'GBP');
  assert.match(rig.get('workspace-records').textContent, /No saved records/);
  for (const action of ['workspace-clear', 'workspace-sample', 'workspace-undo']) {
    const other = browserRig(); let release;
    if (action === 'workspace-undo') other.get('workspace-sample').click();
    other.select(new Promise(resolve => { release = resolve; }));
    other.get(action).click();
    release(fileA); await flush();
    assert.equal(other.get('workspace-open-import').hidden, true, action);
  }
});

test('HTML form has every schema field, explicit privacy/recovery notices and a no-script path', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../docs/PILOT_WORKSPACE.html'), 'utf8');
  for (const field of pilot.fields) assert.ok(html.includes('name="' + field + '"'), field);
  for (const notice of ['unencrypted JSON', 'no cloud sync', 'personal data', 'not establish', 'UNKNOWN', '<noscript>', 'Print saved scorecard and records']) assert.ok(html.includes(notice), notice);
});
