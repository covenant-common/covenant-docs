'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const catalogText = fs.readFileSync(path.join(root, 'assets/capability-catalog.json'), 'utf8');
const catalog = JSON.parse(catalogText);
const html = fs.readFileSync(path.join(root, 'docs/EXPLORE.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'assets/explore.js'), 'utf8');
const explorer = require('../assets/explore.js');
const names = Object.keys(catalog.tools).sort();
const sourceHash = '8d39081ff54759816a812de44a89fbd97ddf4b1bdee3e6914843c9b8b2adf5e9';
const sourceCommit = 'ba76a50bf4ac26a52bdf6244ef6a368529221ff3';
// Reviewed metadata-only disposition: three additions; every earlier family
// and public navigation alias is retained unchanged. No runtime is exported.
const addedFamilies = ['covenant_panel_successor', 'covenant_tender', 'covenant_tender_write'];
const addedAliases = {
  covenant_panel_vote: ['review panel panels votes'],
  covenant_panel_successor: ['replace review panel panels successor replacement continuity', 'continue panel review'],
  covenant_network_trust: ['agent cv cvs curriculum vitae contextual qualifications', 'inspect optional supplier evidence'],
  covenant_stripe: ['owner limit limits spending budget gateway per order allowance'],
  covenant_principal: ['owner limit limits spending budget allowance approval permissions expiry', 'set give agent spending limit limits'],
  covenant_representation: ['owner limit limits delegated approval scope spending permission permissions'],
  covenant_tender: ['tender tenders procurement request requests work requirements', 'private procurement compare proposals suppliers'],
  covenant_tender_write: ['tender tenders procurement prepare request work', 'invite proposals submit proposal proposals']
};
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.value = ''; this.dataset = {}; this.events = {}; this.hidden = true; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
}
function documentFixture(data = catalog) {
  const ids = {};
  const created = [];
  ['capability-catalog', 'explore-controls', 'explore-query', 'explore-level', 'explore-maturity', 'explore-core', 'explore-species', 'explore-results', 'explore-count', 'explore-clear', 'explore-live'].forEach((id) => { ids[id] = new Element('div'); });
  ids['capability-catalog'].textContent = JSON.stringify(data);
  const counts = catalog.order.map((id) => { const node = new Element('span'); node.dataset.layerCount = id; return node; });
  const buttons = catalog.order.map((id) => { const node = new Element('button'); node.dataset.exploreLayer = id; return node; });
  const doc = {
    createElement(tag) { const node = new Element(tag); created.push(node); return node; },
    getElementById(id) { return ids[id]; },
    querySelectorAll(selector) { return selector === '[data-layer-count]' ? counts : selector === '[data-explore-layer]' ? buttons : []; }
  };
  return {doc, ids, created, counts, buttons};
}
function renderedNames(node) {
  return (node.tagName === 'code' ? [node.textContent] : []).concat(node.children.flatMap(renderedNames));
}

test('metadata projection has exactly 179 unique families and six intact layers', () => {
  assert.equal(names.length, 179);
  assert.deepEqual(catalog.order, ['ORGANON', 'L0', 'L1', 'L2', 'L3', 'L4']);
  assert.deepEqual(catalog.levels.map((level) => level.id), catalog.order);
  assert.deepEqual(catalog.core_levels, ['ORGANON', 'L0', 'L1', 'L2', 'L3']);
  assert.equal(catalog.profile, 'urn:aap:levels:0.2');
  assert.equal(catalog.source.sha256, sourceHash);
  assert.equal(catalog.source.commit, sourceCommit);
  assert.equal(catalog.source.file, 'aap_levels.json');
  assert.deepEqual(Object.keys(catalog.source).sort(), ['commit', 'file', 'projection', 'sha256']);
  assert.deepEqual(Object.keys(catalog).sort(), ['categories', 'core_levels', 'levels', 'maturity', 'note', 'order', 'profile', 'source', 'species', 'tools']);
  assert.equal(catalog.categories.length, 10);
  assert.equal(catalog.species.length, 8);
  const levels = new Set(catalog.order);
  const species = new Set(catalog.species.map((kind) => kind.id));
  names.forEach((name) => {
    assert.equal(catalogText.split(JSON.stringify(name) + ':').length - 1, 1, name + ' must occur once as a projected key');
    const tool = catalog.tools[name];
    assert.deepEqual(Object.keys(tool).sort(), ['core', 'level', 'maturity', 'species']);
    assert.ok(levels.has(tool.level), name);
    assert.ok(tool.species === null || species.has(tool.species), name);
    assert.equal(typeof tool.core, 'boolean');
    assert.ok(['beta', 'experimental'].includes(tool.maturity), name);
  });
  assert.equal(names.filter((name) => catalog.tools[name].maturity === 'beta').length, 135);
  assert.equal(names.filter((name) => catalog.tools[name].maturity === 'experimental').length, 44);
  assert.deepEqual(catalog.order.map((level) => names.filter((name) => catalog.tools[name].level === level).length), [26, 22, 34, 37, 11, 49]);
  assert.ok(!/module_rules|module_overrides|covenant_chain\//.test(catalogText));
});

test('reviewed refresh adds only three families and preserves all 176 earlier records and aliases', () => {
  assert.deepEqual(addedFamilies.map((name) => [name, catalog.tools[name]]), [
    ['covenant_panel_successor', {level: 'L3', core: true, maturity: 'beta', species: null}],
    ['covenant_tender', {level: 'L4', core: false, maturity: 'experimental', species: 'service'}],
    ['covenant_tender_write', {level: 'L4', core: false, maturity: 'experimental', species: 'service'}]
  ]);
  const retained = names.filter((name) => !addedFamilies.includes(name));
  assert.equal(retained.length, 176);
  assert.equal(sha256(retained.join('\n') + '\n'), '1f5d121b38d86e4c77d11fa79f88305e0bd964d855c359c32bb5afec6036fd79');
  assert.equal(sha256(JSON.stringify(retained.map((name) => [name, ...['level', 'core', 'maturity', 'species'].map((key) => catalog.tools[name][key])]))), '6124c5fcef8c46dae392c7e7a64e2185badf4f090c836c4b982f4824932ad027');
  Object.entries(addedAliases).forEach(([name, aliases]) => aliases.forEach((alias) => assert.ok(explorer.navigationAliases[name].includes(alias), name + ': ' + alias)));
  const retainedAliases = Object.fromEntries(Object.entries(explorer.navigationAliases)
    .filter(([name]) => !addedFamilies.includes(name))
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([name, aliases]) => [name, aliases.filter((alias) => !(addedAliases[name] || []).includes(alias))]));
  assert.equal(sha256(JSON.stringify(retainedAliases)), '3efeb937e39700d6ff32757f0be860a12deb520a68f4e4fa6feb12debad94425');
  addedFamilies.forEach((name) => assert.ok(html.includes('<code>' + name + '</code>')));
  assert.ok(html.includes(sourceHash) && html.includes(sourceCommit));
});

test('embedded catalog is identical to the downloadable projection and static routes remain available', () => {
  const embedded = html.match(/<script id="capability-catalog" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), catalog);
  catalog.order.forEach((id) => {
    assert.ok(html.includes('id="layer-' + id.toLowerCase() + '"'));
    assert.ok(html.includes('data-explore-layer="' + id + '"'));
  });
  ['START.html', 'CAPABILITIES.html', 'MATRIX.html', 'API_MCP.html#public', 'API_MCP.html#trial', 'RESEARCH.html', '../assets/capability-catalog.json'].forEach((route) => assert.ok(html.includes('href="' + route + '"'), route));
  assert.match(html, /<noscript>[\s\S]*?complete public metadata catalog[\s\S]*?<\/noscript>/);
  assert.match(html, /135 tool families are labelled beta and 44 experimental/);
  assert.match(html, /none is stable/);
  assert.ok(!html.includes('MODULE_RULES'));
});

test('empty query, exhaustive family lookup, and disjoint filters preserve complete coverage', () => {
  assert.deepEqual(explorer.filterCatalog(catalog, {}).map((tool) => tool.name).sort(), names);
  assert.equal(explorer.filterCatalog(catalog, {query: '   '}).length, 179);
  names.forEach((name) => assert.deepEqual(explorer.filterCatalog(catalog, {query: name}).map((tool) => tool.name), [name], name));
  const union = catalog.order.flatMap((level) => explorer.filterCatalog(catalog, {level}).map((tool) => tool.name));
  assert.equal(new Set(union).size, 179);
  assert.deepEqual(union.sort(), names);
  const readiness = ['beta', 'experimental'].flatMap((maturity) => explorer.filterCatalog(catalog, {maturity}).map((tool) => tool.name));
  assert.deepEqual(readiness.sort(), names);
  assert.deepEqual(['core', 'extension'].flatMap((core) => explorer.filterCatalog(catalog, {core}).map((tool) => tool.name)).sort(), names);
  const assigned = catalog.species.map((kind) => kind.id).concat('unassigned').flatMap((species) => explorer.filterCatalog(catalog, {species}).map((tool) => tool.name));
  assert.deepEqual(assigned.sort(), names);
  const formal = explorer.filterCatalog(catalog, {query: 'formal'});
  assert.equal(formal.length, 34);
  assert.ok(formal.every((tool) => tool.level === 'L1'));
  assert.ok(explorer.filterCatalog(catalog, {query: 'ESCROW', level: 'L2', maturity: 'beta', core: 'core'}).some((tool) => tool.name === 'covenant_escrow'));
  assert.equal(explorer.filterCatalog(catalog, {maturity: 'stable'}).length, 0);
});

test('reported everyday needs find actual relevant families without matching entire layer scopes', () => {
  const expected = {
    coordinate: ['covenant_agreement', 'covenant_roles', 'covenant_org', 'covenant_obligations'],
    collaborate: ['covenant_org', 'covenant_roles', 'covenant_forum_read', 'covenant_forum_write'],
    group: ['covenant_org', 'covenant_roles', 'covenant_vote'],
    team: ['covenant_org', 'covenant_roles', 'covenant_forum_read'],
    handoff: ['covenant_continue', 'covenant_deliver', 'covenant_delivery'],
    discussion: ['covenant_forum_read', 'covenant_forum_write'],
    voting: ['covenant_vote', 'covenant_consensus_vote', 'covenant_panel_vote']
  };
  Object.entries(expected).forEach(([query, relevant]) => {
    const matches = explorer.filterCatalog(catalog, {query});
    const found = matches.map((tool) => tool.name);
    relevant.forEach((name) => assert.ok(found.includes(name), query + ' should find ' + name));
    assert.ok(found.length > 0 && found.length < 25, query + ' should remain a bounded navigation match');
    assert.ok(!found.includes('covenant_ads'), query + ' must not inherit the whole L4 scope');
    assert.ok(matches.some((tool) => tool.matchReason.startsWith('Navigation alias:')), query);
  });
  const research = explorer.filterCatalog(catalog, {query: 'research'}).map((tool) => tool.name);
  ['covenant_org', 'covenant_forum_read', 'covenant_forum_write', 'covenant_review'].forEach((name) => assert.ok(research.includes(name)));
  ['covenant_ads', 'covenant_ad_report', 'covenant_advertise', 'covenant_attention', 'covenant_wager', 'covenant_token', 'covenant_auction', 'covenant_robotics'].forEach((name) => assert.ok(!research.includes(name), name));
  assert.ok(research.length < 15);
  assert.deepEqual(explorer.filterCatalog(catalog, {query: 'research', level: 'L4'}).map((tool) => tool.name), research.filter((name) => catalog.tools[name].level === 'L4'));
});

test('navigation aliases are explicit public copy and natural queries keep constraints honest', () => {
  const snapshot = JSON.stringify(catalog);
  Object.entries(explorer.navigationAliases).forEach(([name, aliases]) => {
    assert.ok(Object.hasOwn(catalog.tools, name), name);
    assert.ok(Array.isArray(aliases) && aliases.length > 0, name);
    assert.ok(Object.isFrozen(aliases));
  });
  assert.ok(Object.isFrozen(explorer.navigationAliases));
  ['shared methods', 'reusable methods'].forEach((query) => {
    const found = explorer.filterCatalog(catalog, {query}).map((tool) => tool.name);
    ['covenant_procedures', 'covenant_publish_procedure', 'covenant_recall'].forEach((name) => assert.ok(found.includes(name)));
    assert.ok(!found.includes('covenant_ads'));
  });
  assert.deepEqual(explorer.filterCatalog(catalog, {query: 'please help me coordinate a team'}).map((tool) => tool.name), ['covenant_org', 'covenant_roles']);
  assert.deepEqual(explorer.filterCatalog(catalog, {query: 'auctions'}).map((tool) => tool.name), ['covenant_auction']);
  const payments = explorer.filterCatalog(catalog, {query: 'payments'}).map((tool) => tool.name);
  ['covenant_escrow', 'covenant_settle', 'covenant_settlement', 'covenant_stripe'].forEach((name) => assert.ok(payments.includes(name)));
  assert.ok(!payments.includes('covenant_robotics'));
  assert.equal(explorer.filterCatalog(catalog, {query: 'unrecognised quokka capability'}).length, 0);
  assert.equal(explorer.filterCatalog(catalog, {query: 'research without payment'}).length, 0);
  assert.equal(explorer.filterCatalog(catalog, {query: 'grant unrestricted authority'}).length, 0);
  assert.equal(JSON.stringify(catalog), snapshot);
});

test('current collaboration, reviewer and supplier-evidence needs reach the retained families', () => {
  for (const [query, family] of [
    ['organise a volunteer group', 'covenant_collaboration'],
    ['choose independent reviewers', 'covenant_arbitration_design'],
    ['compare suppliers', 'covenant_network_trust'],
    ['resume cooperation plan', 'resume_cooperation']
  ]) {
    const found = explorer.filterCatalog(catalog, { query }).map(row => row.name);
    assert.ok(found.includes(family), query + ' → ' + family);
  }
  assert.equal(explorer.filterCatalog(catalog, { query: 'grant everyone unlimited authority' }).length, 0);
});

test('CVs, owner limits, panels and tenders find actual installed families without invented interfaces', () => {
  for (const [query, expected] of [
    ['agent CV', ['covenant_network_trust']],
    ['inspect optional supplier evidence', ['covenant_network_trust']],
    ['owner limits', ['covenant_principal', 'covenant_representation', 'covenant_stripe']],
    ['give my agent a spending limit', ['covenant_principal']],
    ['panels', ['covenant_panel_vote', 'covenant_panel_successor', 'covenant_arbitration_design']],
    ['replace a review panel', ['covenant_panel_successor']],
    ['tenders', ['covenant_tender', 'covenant_tender_write']]
  ]) {
    const found = explorer.filterCatalog(catalog, {query}).map((row) => row.name);
    expected.forEach((name) => assert.ok(found.includes(name), query + ' → ' + name));
    assert.ok(found.length < 12, query + ' must stay a bounded navigation match');
    assert.ok(!found.includes('covenant_ads'));
  }
  assert.ok(!Object.hasOwn(catalog.tools, 'covenant_cv'));
  assert.equal(explorer.filterCatalog(catalog, {query: 'covenant_cv'}).length, 0);
  const fixture = documentFixture();
  explorer.renderResults(fixture.ids['explore-results'], catalog, {query: 'panels'}, fixture.doc);
  assert.match(fixture.ids['explore-results'].textContent, /installed preview · beta/);
  assert.ok(!fixture.ids['explore-results'].textContent.includes('public tool'));
});

test('the rendered search explains alias matches and returns no invented result for unknown needs', () => {
  const {doc, ids} = documentFixture();
  explorer.mount(doc);
  ids['explore-query'].value = 'discussion';
  ids['explore-query'].events.input();
  assert.match(ids['explore-results'].textContent, /Navigation alias: discussion\./);
  assert.ok(renderedNames(ids['explore-results']).includes('covenant_forum_read'));
  ids['explore-query'].value = 'unrecognised quokka capability';
  ids['explore-query'].events.input();
  assert.equal(ids['explore-count'].textContent, 'Showing 0 of 179 installed tool families.');
  assert.match(ids['explore-results'].textContent, /No tool families match/);
  assert.equal(renderedNames(ids['explore-results']).length, 0);
});

test('render and filter hostile strings as literal text without HTML injection or effects', () => {
  const unsafe = '<img src=x onerror=alert(1)> & <script>alert(2)</script>';
  const data = JSON.parse(JSON.stringify(catalog));
  const original = Object.keys(data.tools)[0];
  data.tools[unsafe] = data.tools[original];
  delete data.tools[original];
  const fixture = documentFixture(data);
  explorer.renderResults(fixture.ids['explore-results'], data, {}, fixture.doc);
  assert.ok(renderedNames(fixture.ids['explore-results']).includes(unsafe));
  assert.ok(!fixture.created.some((node) => ['img', 'script', 'iframe', 'a'].includes(node.tagName)));
  assert.equal(explorer.filterCatalog(data, {query: unsafe}).length, 1);
  assert.equal(explorer.filterCatalog(catalog, {query: unsafe}).length, 0);
  ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval(', 'new Function', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage', 'document.cookie', 'URLSearchParams', 'location.'].forEach((operation) => assert.ok(!script.includes(operation), operation));
});

test('mounted controls show all, update honest counts and clear every active filter', () => {
  const {doc, ids, counts, buttons} = documentFixture();
  explorer.mount(doc);
  assert.equal(ids['explore-controls'].hidden, false);
  assert.equal(ids['explore-live'].hidden, false);
  assert.equal(ids['explore-count'].textContent, 'Showing 179 of 179 installed tool families.');
  assert.deepEqual(renderedNames(ids['explore-results']).sort(), names);
  ids['explore-query'].value = 'escrow';
  ids['explore-query'].events.input();
  const count = renderedNames(ids['explore-results']).length;
  assert.equal(counts.reduce((sum, node) => sum + Number(node.textContent), 0), count);
  assert.equal(ids['explore-count'].textContent, 'Showing ' + count + ' of 179 installed tool families.');
  buttons.find((button) => button.dataset.exploreLayer === 'L4').events.click();
  assert.equal(ids['explore-level'].value, 'L4');
  ids['explore-maturity'].value = 'experimental';
  ids['explore-core'].value = 'extension';
  ids['explore-species'].value = 'risk';
  ids['explore-clear'].events.click();
  ['explore-query', 'explore-level', 'explore-maturity', 'explore-core', 'explore-species'].forEach((id) => assert.equal(ids[id].value, ''));
  assert.equal(renderedNames(ids['explore-results']).length, 179);
  assert.equal(ids['explore-query'].focused, true);
});

test('projection SHA and every permitted field match the exact source snapshot when supplied', {skip: !process.env.AAP_LEVELS_SOURCE && 'Set AAP_LEVELS_SOURCE to verify the private input snapshot.'}, () => {
  const bytes = fs.readFileSync(process.env.AAP_LEVELS_SOURCE);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), catalog.source.sha256);
  const source = JSON.parse(bytes.toString('utf8'));
  assert.deepEqual(Object.keys(source.tools).sort(), names);
  ['profile', 'note', 'order', 'core_levels', 'levels', 'categories', 'species', 'maturity'].forEach((key) => assert.deepEqual(catalog[key], source[key], key));
  names.forEach((name) => ['level', 'core', 'maturity', 'species'].forEach((key) => assert.deepEqual(catalog.tools[name][key], source.tools[name][key], name + '.' + key)));
});
