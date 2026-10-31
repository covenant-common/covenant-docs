const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const start = require('../assets/start.js');

test('all first-job routes use the current public connection and preserve owner approval', () => {
  for (const name of ['connect', 'advertise', 'buy', 'coordinate']) {
    const r = start.route(name);
    assert.ok(r.prompt.includes(start.MCP));
    assert.match(r.prompt, /discover the actual (?:public )?tools/i);
    assert.match(r.prompt, /private.*(?:key|access file)|private signing keys/i);
    assert.ok(r.steps.length >= 3);
    assert.match(r.outcome, /draft|advert|job|plan|workflow/i);
    assert.ok(!r.prompt.includes('aap_wallet_'));
    assert.ok(!r.prompt.includes('pip install agentic-agreements'));
  }
  assert.throws(() => start.route('__proto__'));
  assert.throws(() => start.route('pay-now'));
  const changed = start.route('connect'); changed.primary[0] = 'https://evil.example';
  assert.equal(start.route('connect').primary[0], 'API_MCP.html#connect');
});

test('only bounded public source tags and closed task choices survive hostile query input', () => {
  assert.deepEqual(start.tags('?source=github&campaign=pilot-one&ref=alice-public&token=SECRET'), { source: 'github', campaign: 'pilot-one', ref: 'alice-public' });
  for (const input of [
    '?source=evil&campaign=%3Cscript%3E&ref=alice%40example.com',
    '?source=github&source=glama&campaign=one&campaign=two&ref=alice&ref=bob',
    '?source=github%0A&ref=' + 'a'.repeat(64),
    '?' + 'x'.repeat(5000)
  ]) assert.deepEqual(start.tags(input), {});
  assert.equal(start.task('?task=buy'), 'buy');
  assert.equal(start.task('?task=coordinate'), 'coordinate');
  assert.equal(start.task('?task=__proto__'), 'connect');
  assert.equal(start.task('?task=buy&task=advertise'), 'connect');
});

test('guide links carry public labels without accepting off-site destinations or secret parameters', () => {
  const result = new URL(start.taggedLink('TRIAL.html?token=not-used#setup', { source: 'mcp-registry', campaign: 'pilot-one', ref: 'friend-public', private_seed: 'SECRET' }));
  assert.equal(result.origin, 'https://covenant-common.github.io');
  assert.equal(result.pathname, '/covenant-docs/docs/TRIAL.html');
  assert.equal(result.searchParams.get('source'), 'mcp-registry');
  assert.equal(result.searchParams.get('campaign'), 'pilot-one');
  assert.equal(result.searchParams.get('ref'), 'friend-public');
  assert.equal(result.searchParams.has('private_seed'), false);
  assert.equal(result.searchParams.has('token'), false);
  assert.equal(result.hash, '#setup');
  assert.throws(() => start.taggedLink('https://evil.example/TRIAL.html', {}));
  assert.throws(() => start.taggedLink('javascript:alert(1)', {}));
  assert.throws(() => start.taggedLink('https://SECRET@covenant-common.github.io/covenant-docs/docs/TRIAL.html', {}));
});

test('sharing creates only a canonical public start link and awards no promotion', () => {
  const url = new URL(start.shareLink('advertise', 'public-friend'));
  assert.equal(url.pathname, '/covenant-docs/docs/START.html');
  assert.deepEqual(Object.fromEntries(url.searchParams), { task: 'advertise', source: 'referral', ref: 'public-friend' });
  assert.equal(new URL(start.shareLink('buy', '')).searchParams.get('source'), 'community');
  assert.throws(() => start.shareLink('buy', 'private@example.com'));
  assert.throws(() => start.shareLink('buy', 'a'.repeat(64)));
  assert.throws(() => start.shareLink('buy', 'rk_live_PRIVATE'));
  assert.throws(() => start.shareLink('buy', 'abcdef0123456789abcdef0123456789'));
  assert.throws(() => start.shareLink('buy', '123456789'));
  assert.throws(() => start.shareLink('pay', 'okay-name'));
});

test('pilot reports identify self-reported progress without inventing server observations', () => {
  const report = start.note('buy', { source: 'github', token: 'PRIVATE' }, 'Buy a chart', 'I needed help with approval.', { connection: 'completed', draft: 'completed', approval: 'blocked', outcome: 'not-tried', repeat: 'not-tried' });
  assert.match(report, /self-reported; not independently verified/);
  assert.match(report, /Connect an agent: Self-reported completed/);
  assert.match(report, /Approve and retain exact terms: Self-reported blocked/);
  assert.ok(!report.includes('PRIVATE'));
  assert.match(report, /Source labels do not establish visits, activation, orders or earned referrals/);
  assert.throws(() => start.note('buy', {}, '', '', {}));
  assert.throws(() => start.note('buy', {}, 'Goal', '', { secret: 'token' }));
  assert.throws(() => start.note('buy', {}, 'Goal', '', { outcome: 'verified-paid' }));
  assert.throws(() => start.note('buy', {}, 'Goal\u001b', '', {}));
  assert.throws(() => start.note('buy', {}, 'My key is rk_live_SYNTHETIC', '', {}));
  assert.throws(() => start.note('buy', {}, 'My record is ' + 'a'.repeat(64), '', {}));
  const email = new URL(start.email(report));
  assert.equal(email.protocol, 'mailto:');
  assert.equal(email.pathname, 'jupitersstring@gmail.com');
  assert.equal(email.searchParams.get('body'), report);
});

test('new page retains no-script routes, all capabilities and a private owner handoff', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'docs/START.html'), 'utf8');
  for (const href of ['API_MCP.html', 'TRIAL.html', 'TERMINAL.html', 'OWNER_SETUP.html', 'OWNER_TRADE.html', 'PAYMENTS.html', 'CAPABILITIES.html', 'MATRIX.html']) {
    assert.ok(html.includes(href), href);
    assert.ok(fs.existsSync(path.join(root, 'docs', href)), href);
  }
  assert.match(html, /<noscript>/);
  assert.ok(html.includes('../mcp-config.json'));
  assert.ok(html.includes('../assets/theme.css'));
  assert.ok(html.includes('nothing is stored or sent automatically'));
  assert.ok(html.includes('broader installed capabilities'));
  assert.ok(html.includes('copied or visited link earns no reward'));
});

function browserRig({ clipboardFailure = false, search = '?task=advertise&source=github&token=PRIVATE' } = {}) {
  class Element {
    constructor(id = '') { this.id = id; this.dataset = {}; this.attributes = {}; this.children = []; this.handlers = {}; this._text = ''; this.value = ''; }
    set textContent(value) { this._text = value; this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    replaceChildren() { this.children = []; this._text = ''; }
    appendChild(child) { this.children.push(child); }
    addEventListener(name, handler) { this.handlers[name] = handler; }
  }
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Element(id)); return nodes.get(id); };
  const routes = ['connect', 'advertise', 'buy', 'coordinate'].map(route => { const el = new Element(); el.dataset.startRoute = route; return el; });
  const stages = start.stages.map(stage => { const el = new Element(); el.dataset.startStage = stage; el.value = 'not-tried'; return el; });
  const tags = ['start-primary', 'start-secondary'].map((id, index) => { const el = get(id); el.attributes.href = index ? 'TRIAL.html' : 'API_MCP.html#connect'; return el; });
  const writes = [], external = [];
  const location = { search, href: 'https://covenant-common.github.io/covenant-docs/docs/START.html' };
  const context = {
    URL, URLSearchParams, document: { getElementById: get, createElement: () => new Element(), querySelectorAll: selector => selector === '[data-start-route]' ? routes : selector === '[data-start-stage]' ? stages : tags },
    location, navigator: { clipboard: { async writeText(text) { if (clipboardFailure) throw new Error('denied'); writes.push(text); } } },
    fetch() { external.push('fetch'); throw new Error('Unexpected network request'); },
    localStorage: { setItem() { throw new Error('Unexpected storage'); } },
    sessionStorage: { setItem() { throw new Error('Unexpected storage'); } },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../assets/start.js'), 'utf8'), context);
  return { nodes, get, routes, stages, writes, external, location };
}

test('actual page handlers select a route and copy the exact prompt without contacting a service', async () => {
  const rig = browserRig();
  assert.equal(rig.get('start-route-title').textContent, start.route('advertise').title);
  assert.equal(rig.routes[1].attributes['aria-pressed'], 'true');
  assert.equal(new URL(rig.get('start-primary').href).searchParams.get('source'), 'github');
  assert.equal(new URL(rig.get('start-primary').href).searchParams.has('token'), false);
  rig.routes[2].handlers.click();
  assert.equal(rig.get('start-route-title').textContent, start.route('buy').title);
  assert.equal(rig.get('start-steps').children.length, start.route('buy').steps.length);
  assert.match(rig.get('start-prompt').textContent, /not a complete payable checkout packet/);
  rig.get('start-copy-prompt').handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rig.writes[0], start.route('buy').prompt);
  assert.match(rig.get('start-prompt-status').textContent, /^Copied/);
  assert.deepEqual(rig.external, []);
});

test('clipboard failure gives visible manual text and the report is sent only as an explicit email draft', async () => {
  const rig = browserRig({ clipboardFailure: true });
  rig.get('start-copy-mcp').handlers.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(rig.get('start-copy-status').textContent, /Automatic copy is unavailable/);
  assert.ok(rig.get('start-copy-status').textContent.includes(start.MCP));
  rig.get('start-goal').value = 'Advertise one proofreading service';
  rig.get('start-friction').value = 'I needed help choosing what to publish.';
  rig.stages[0].value = 'completed';
  assert.ok(rig.location.href.startsWith('https://'));
  let prevented = false;
  rig.get('start-report-form').handlers.submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  const draft = new URL(rig.location.href);
  assert.equal(draft.protocol, 'mailto:');
  assert.match(draft.searchParams.get('body'), /Self-reported completed/);
  assert.ok(!draft.searchParams.get('body').includes('PRIVATE'));
  assert.match(rig.get('start-report-status').textContent, /submitted nothing/);
  assert.deepEqual(rig.external, []);
});
