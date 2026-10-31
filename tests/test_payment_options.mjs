import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require = createRequire(import.meta.url);
const view = require('../assets/payment-options.js');
const PRINCIPAL = 'EXACT_SELLER_ADOPTED_PER_DEAL_SIGNED_DESTINATION';
const BTC = 'bc1qrthlhxrqadcnw30atr8p78ek5gffz4n346nmhc';
const EVM = '0xa200dCD20612B73E211f8e39EE15d7627A871abc';
const SOL = 'BVjG6kZrtQf5D6dra8jpZcG4RPqY6NzsYnhvbKUrTKhW';

function catalog() {
  return {version:view.VERSION, read_only:true, execution_authorized:false,
    selection_authorizes_payment:false, collection_activated:false, principal_destination:PRINCIPAL,
    registry:{source_sha256:'856317db1f8f92568eed21edc1fdc6eb0addaae1c44c932495ceb063c7927d3d'},
    methods:view.fallback().map(row => ({id:row.id, label:'untrusted label is not displayed',
      network:row.network, asset:row.asset, readiness:row.readiness, selectable:true,
      executable:false, settlement_enabled:false, execution_authorized:false, collection_activated:false,
      principal_destination:PRINCIPAL, account_role:'PLATFORM_FEE_ONLY', connection_installed:false,
      testnet:row.testnet, mode:row.id==='card'?null:row.testnet?'test':'live',
      fee_destination:row.id==='card'?null:{network:row.network, account:row.feeAccount, asset:row.asset,
        testnet:row.testnet, purpose:'PLATFORM_FEE_ONLY', seller_principal_destination:false,
        collection_activated:false}}))};
}
function change(identifier, edit) {
  const value = catalog(); edit(value.methods.find(row => row.id===identifier), value); return value;
}

test('all saved methods remain visible with test and native choices separated', () => {
  const rows = view.fallback();
  assert.deepEqual(rows.map(row=>row.id), ['card','bitcoin','usdc-base','usdc-ethereum','usdc-solana',
    'usdc-base-sepolia','usdc-ethereum-sepolia','aap-native']);
  assert.equal(rows.filter(row=>row.group==='Payment choices').length,5);
  assert.deepEqual(rows.filter(row=>row.group==='Test networks').map(row=>[row.network,row.readiness]),
    [['eip155:84532','TEST_ONLY'],['eip155:11155111','TEST_ONLY']]);
  assert.equal(rows.find(row=>row.id==='aap-native').readiness,'NOT_LIVE');
  assert.equal(rows.find(row=>row.id==='bitcoin').feeAccount,BTC);
  for (const id of ['usdc-base','usdc-ethereum','usdc-base-sepolia','usdc-ethereum-sepolia'])
    assert.equal(rows.find(row=>row.id===id).feeAccount,EVM);
  assert.equal(rows.find(row=>row.id==='usdc-solana').feeAccount,SOL);
});

test('host catalogue is inspected without borrowing its labels or claiming payment readiness', () => {
  const value = catalog(); value.methods.reverse();
  const rows = view.inspectCatalog(value);
  assert.equal(rows[0].label,'Card');
  assert.equal(rows[1].label,'Bitcoin');
  assert.ok(rows.every(row=>row.source==='host'));
  assert.ok(!view.renderOptions(rows).includes('untrusted label'));
  assert.ok(!view.renderOptions(rows).includes('Pay now'));
  const installed = change('usdc-base', row => {row.readiness='CONFIGURED_UNVERIFIED';row.connection_installed=true;});
  assert.match(view.inspectCatalog(installed).find(row=>row.id==='usdc-base').readinessLabel,/check the deal/);
});

test('redirected fees, wrong networks and a principal default are refused', () => {
  const bad = [
    change('bitcoin', row=>{row.fee_destination.account=EVM;}),
    change('usdc-base', row=>{row.fee_destination.account='0x0000000000000000000000000000000000000001';}),
    change('usdc-solana', row=>{row.fee_destination.network='eip155:8453';}),
    change('usdc-ethereum', row=>{row.network='eip155:8453';}),
    change('usdc-ethereum', row=>{row.fee_destination.seller_principal_destination=true;}),
    change('usdc-ethereum', row=>{row.fee_destination.purpose='SELLER_PRINCIPAL';}),
    change('card', row=>{row.principal_destination='PLATFORM_DEFAULT';})
  ];
  for (const value of bad) assert.throws(()=>view.inspectCatalog(value),/PAYMENT_OPTIONS_UNRECOGNIZED/);
});

test('a card connection accepts only the approved fee account and never an automatic charge', () => {
  const value = change('card', row => {
    row.mode='live';row.connection_installed=true;row.readiness='CONFIGURED_UNVERIFIED';
    row.fee_destination={network:'stripe',account:'acct_1OwrpHI7y06m5siQ',asset:row.asset,
      purpose:'PLATFORM_FEE_ONLY',seller_principal_destination:false,collection_activated:false};
  });
  assert.equal(view.inspectCatalog(value)[0].feeAccount,'acct_1OwrpHI7y06m5siQ');
  const redirected=structuredClone(value);redirected.methods[0].fee_destination.account='acct_OTHER';
  assert.throws(()=>view.inspectCatalog(redirected));
  const charged=structuredClone(value);charged.methods[0].fee_destination.collection_activated=true;
  assert.throws(()=>view.inspectCatalog(charged));
  const missing=structuredClone(value);missing.methods[0].fee_destination=null;
  assert.throws(()=>view.inspectCatalog(missing));
});

test('unknown, duplicated, live-claim and test-network substitutions fail closed', () => {
  const values = [null,[],{},change('aap-native', row=>{row.readiness='LIVE';}),
    change('usdc-base', row=>{row.executable=true;}),
    change('usdc-ethereum-sepolia', row=>{row.testnet=false;}),
    change('usdc-base', row=>{row.readiness='CONFIGURED_UNVERIFIED';}),
    change('bitcoin', row=>{row.settlement_enabled=true;})];
  const duplicate=catalog();duplicate.methods[7]=structuredClone(duplicate.methods[0]);values.push(duplicate);
  const unknown=catalog();unknown.methods[0].id='new-provider';values.push(unknown);
  const missing=catalog();missing.methods.pop();values.push(missing);
  const wrongPin=catalog();wrongPin.registry.source_sha256='0'.repeat(64);values.push(wrongPin);
  for (const value of values) assert.throws(()=>view.inspectCatalog(value),/PAYMENT_OPTIONS_UNRECOGNIZED/);
});

test('rendering shows fee purpose and does not turn addresses into transfer links', () => {
  const html=view.renderOptions(view.fallback());
  assert.equal((html.match(/data-payment-method=/g)||[]).length,8);
  assert.match(html,/Covenant fee destination only/);
  assert.match(html,/Do not send the order price/);
  assert.match(html,/test transfer does not pay a real bill/);
  assert.match(html,/No live payment address/);
  assert.ok(!/<(?:input|form|iframe|script)\b/i.test(html));
  assert.ok(!/(?:bitcoin:|ethereum:|solana:|href=)/i.test(html));
  const injected=view.fallback();injected[0].label='<img src=x onerror=steal()>';
  assert.ok(!view.renderOptions(injected).includes('<img'));
  assert.match(view.renderOptions(injected),/&lt;img/);
  const changed=view.fallback();changed[0].steps[0]='changed';
  assert.notEqual(view.fallback()[0].steps[0],'changed');
});

test('connection check uses one fixed HTTPS URL without credentials or redirects', async () => {
  const calls=[];
  const rows=await view.loadCatalog(async (url,options) => {
    calls.push({url,options});
    return {ok:true,text:async()=>JSON.stringify({ok:true,result:catalog()})};
  });
  assert.equal(rows.length,8);assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://jupie202020.pythonanywhere.com/payment-methods.json');
  assert.equal(calls[0].options.method,'GET');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.cache,'no-store');
  assert.deepEqual(calls[0].options.headers,{Accept:'application/json'});
});

test('missing endpoint, malformed response and oversized body preserve the saved-list route', async () => {
  for (const response of [{ok:false,text:async()=>''}, {ok:true,text:async()=>'not json'},
    {ok:true,text:async()=>'x'.repeat(65537)}, {ok:true,text:async()=>JSON.stringify({ok:false})}])
    await assert.rejects(view.loadCatalog(async()=>response));
  await assert.rejects(view.loadCatalog(async()=>{throw new Error('offline');}));
  assert.equal(view.fallback().length,8);
});

test('public page asks for no payment secrets and retains useful non-script routes', () => {
  const html=readFileSync(new URL('../docs/PAYMENTS.html',import.meta.url),'utf8');
  assert.ok(!/<(?:input|form|iframe)\b/i.test(html));
  assert.match(html,/<noscript>/);
  for (const target of ['MATRIX.html','TRIAL.html','API_MCP.html']) assert.ok(html.includes('href="'+target+'"'));
  assert.match(html,/Your agent should show you the seller, the amount, the network and any Covenant fee/);
  assert.match(html,/no card form or wallet connection/i);
  assert.ok(!/Pay now|Connect wallet|name="(?:token|secret|private_key)"/i.test(html));
});
