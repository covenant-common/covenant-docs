'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const T = require('../assets/terminal.js');
const S = require('../assets/start.js');

test('ordinary coordination requests reach relevant tools without becoming an advert', () => {
  const cases = [
    ['organise a volunteer group', 'groups'],
    ['create a discussion thread', 'forums'],
    ['appoint a moderator', 'forums'],
    ['group vote', 'voting'],
    ['non monetary collaboration', 'coordination'],
    ['record a shared research method', 'reuse'],
    ['send an approved message to a human', 'contact']
  ];
  for (const [query, expected] of cases) {
    const r = T.rankNavigation(T.catalogue, query, 'installed');
    assert.equal(r.routes[0].id, expected, query);
    assert.ok(!r.routes.some(x => x.id === 'advertise'), query);
    assert.ok(Math.abs(r.graph.mass - 1) < 1e-10);
    const publicOnly = T.rankNavigation(T.catalogue, query, 'public');
    assert.equal(publicOnly.reason, 'ACCESS_REQUIRED', query);
    assert.equal(publicOnly.routes.length, 0, query);
  }
});

test('coordination prompts retain an unpaid choice and do not authorise group creation', () => {
  const r = S.route('coordinate');
  assert.equal(S.task('?task=coordinate&source=github'), 'coordinate');
  assert.ok(r.prompt.includes(S.MCP));
  assert.match(r.prompt, /payment is optional/i);
  assert.match(r.prompt, /Do not sign, send messages, create groups, publish or pay/);
  assert.match(r.prompt, /do not invent a public messaging tool/);
  assert.equal(r.primary[0], 'WORK_TOGETHER.html#start');
  for (const other of ['connect', 'buy', 'advertise']) assert.ok(S.route(other));
});

test('the public task projection retains complete current routing with explicit access', () => {
  const c = JSON.parse(fs.readFileSync(require.resolve('../covenant.json'), 'utf8'));
  assert.equal(c.routes.length, 86);
  assert.equal(new Set(c.routes.map(x => x.id)).size, 86);
  for (const id of ['group-collaboration', 'discussion-thread', 'group-role', 'group-vote', 'reuse-method', 'collaboration-design', 'independent-panel', 'private-tender', 'joined-review', 'retained-offline-record', 'arbitration-design', 'feature-map']) {
    const route = c.routes.find(x => x.id === id);
    assert.ok(route, id);
    assert.equal(route.availability, 'OWNER_CONFIGURED_INSTALLED_SYSTEM_NOT_ANONYMOUS_MCP');
    assert.ok(route.native_tool && route.action);
  }
  assert.ok(c.live_public_endpoints.some(x => x.tools === 9));
  assert.ok(c.live_public_endpoints.some(x => x.operations === 29));
});

test('new installed routes retain the exact source action and parameters when a private source snapshot is supplied', {skip: !process.env.AAP_TASK_SOURCE && 'Set AAP_TASK_SOURCE to check the private metadata snapshot.'}, () => {
  const bytes = fs.readFileSync(process.env.AAP_TASK_SOURCE);
  const source = JSON.parse(bytes), current = JSON.parse(fs.readFileSync(require.resolve('../covenant.json'), 'utf8'));
  assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), current.source.installed_catalogue_sha256);
  const byId = new Map(source.routes.map(r => [r.id, r]));
  assert.equal(current.routes.length, source.routes.length);
  for (const row of current.routes) {
    const exact = byId.get(row.id); assert.ok(exact, row.id);
    for (const key of ['native_tool', 'action', 'required_parameters', 'schema_command', 'boundary', 'purpose', 'keywords']) assert.deepEqual(row[key], exact[key], row.id + '.' + key);
  }
});

test('job adverts and private bids lead to the hosted hiring guide at the account tier', () => {
  const route = T.catalogue.find(entry => entry.id === 'hiring');
  assert.equal(route.href, 'ONBOARDING.html#private-hiring');
  assert.equal(route.access, 'account');
  for (const need of ['post a job', 'send a private bid', 'review supplier bids']) {
   assert.equal(T.rankNavigation(T.catalogue, need, 'account').routes[0].id, 'hiring', need);
   assert.ok(T.rankNavigation(T.catalogue, need, 'public').routes.every(entry => entry.id !== 'hiring'), need);
  }
  assert.equal(T.rankNavigation(T.catalogue, 'hire a developer', 'account').routes[0].id, 'services');
  assert.equal(T.rankNavigation(T.catalogue, 'advertise research service', 'account').routes[0].id, 'advertise');
  assert.equal(T.rankNavigation(T.catalogue, 'advertise a service before I post a job', 'account').routes[0].id, 'advertise');
});
