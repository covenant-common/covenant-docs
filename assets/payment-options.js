/* Read-only payment choices. No credentials, wallet connection or payment action. */
(function (global) {
  'use strict';
  const ORIGIN = 'https://jupie202020.pythonanywhere.com';
  const METHODS_URL = ORIGIN + '/payment-methods.json';
  const VERSION = 'urn:aap:hosted-payment-methods:0.1';
  const PRINCIPAL = 'EXACT_SELLER_ADOPTED_PER_DEAL_SIGNED_DESTINATION';
  const PLATFORM_ACCOUNT = 'acct_1OwrpHI7y06m5siQ';
  const EVM = '0xa200dCD20612B73E211f8e39EE15d7627A871abc';
  const BITCOIN = 'bc1qrthlhxrqadcnw30atr8p78ek5gffz4n346nmhc';
  const SOLANA = 'BVjG6kZrtQf5D6dra8jpZcG4RPqY6NzsYnhvbKUrTKhW';
  const SOURCE_SHA256 = '856317db1f8f92568eed21edc1fdc6eb0addaae1c44c932495ceb063c7927d3d';
  const DEFINITIONS = [
    {id:'card', label:'Card', network:'stripe', asset:'EXACT_ADOPTED_FIAT_CURRENCY', group:'Payment choices',
      account:null, testnet:false, states:['NOT_CONNECTED','CONFIGURED_UNVERIFIED','TEST_ONLY'],
      steps:['The seller connects their Stripe account.', 'You approve one checkout showing the price and any Covenant fee.', 'The payment receipt is checked against this deal. Opening checkout alone does not mean it was paid.']},
    {id:'bitcoin', label:'Bitcoin', network:'bitcoin', asset:'BTC', group:'Payment choices',
      account:BITCOIN, testnet:false, states:['NOT_CONNECTED'],
      steps:['Agree the seller’s Bitcoin address, exact amount and confirmation rule.', 'A Bitcoin signing and payment-checking connection must be installed before this can settle a hosted deal.']},
    {id:'usdc-base', label:'USDC on Base', network:'eip155:8453', asset:'USDC', group:'Payment choices',
      account:EVM, testnet:false, states:['NOT_CONNECTED','CONFIGURED_UNVERIFIED'],
      steps:['The seller signs their receiving address for this deal.', 'You sign the exact USDC token, network, recipient and amount in your own wallet.', 'The service checks the network receipt. Network fees are separate.']},
    {id:'usdc-ethereum', label:'USDC on Ethereum', network:'eip155:1', asset:'USDC', group:'Payment choices',
      account:EVM, testnet:false, states:['NOT_CONNECTED','CONFIGURED_UNVERIFIED'],
      steps:['The seller signs their receiving address for this deal.', 'You sign the exact USDC token, network, recipient and amount in your own wallet.', 'The service checks the network receipt. Network fees are separate.']},
    {id:'usdc-solana', label:'USDC on Solana', network:'solana', asset:'USDC', group:'Payment choices',
      account:SOLANA, testnet:false, states:['NOT_CONNECTED'],
      steps:['Agree the exact USDC mint and seller’s receiving token account.', 'A Solana transfer and final receipt-checking connection must be installed before this can settle a hosted deal.']},
    {id:'usdc-base-sepolia', label:'USDC on Base Sepolia', network:'eip155:84532', asset:'USDC', group:'Test networks',
      account:EVM, testnet:true, states:['TEST_ONLY'],
      steps:['Both parties choose this test network explicitly.', 'Only test funds belong here. A test transfer does not pay a real bill. The matching connection is still required.']},
    {id:'usdc-ethereum-sepolia', label:'USDC on Ethereum Sepolia', network:'eip155:11155111', asset:'USDC', group:'Test networks',
      account:EVM, testnet:true, states:['TEST_ONLY'],
      steps:['Both parties choose this test network explicitly.', 'Only test funds belong here. A test transfer does not pay a real bill. The matching connection is still required.']},
    {id:'aap-native', label:'AAP native network', network:'aap', asset:'NATIVE', group:'Future network',
      account:'treasury', testnet:false, states:['NOT_LIVE'],
      steps:['The native payment network is not live.', 'This recorded treasury name is not a live external payment address.']}
  ];
  const LABELS = {NOT_CONNECTED:'Connection needed', CONFIGURED_UNVERIFIED:'Connection installed · check the deal',
    TEST_ONLY:'Test funds only', NOT_LIVE:'Not live'};
  function need(value) { if (!value) throw new Error('PAYMENT_OPTIONS_UNRECOGNIZED'); }
  function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function fallback() {
    return DEFINITIONS.map(d => ({...d, steps:d.steps.slice(), states:d.states.slice(),
      readiness:d.testnet?'TEST_ONLY':d.id==='aap-native'?'NOT_LIVE':'NOT_CONNECTED',
      readinessLabel:LABELS[d.testnet?'TEST_ONLY':d.id==='aap-native'?'NOT_LIVE':'NOT_CONNECTED'],
      connectionInstalled:false, feeAccount:d.account, source:'saved'}));
  }
  function inspectCatalog(value) {
    need(plain(value) && value.version === VERSION && value.read_only === true &&
      value.execution_authorized === false && value.selection_authorizes_payment === false &&
      value.collection_activated === false && value.principal_destination === PRINCIPAL &&
      plain(value.registry) && value.registry.source_sha256 === SOURCE_SHA256 &&
      Array.isArray(value.methods) && value.methods.length === DEFINITIONS.length);
    const seen = new Set();
    for (const row of value.methods) { need(plain(row) && typeof row.id === 'string' && !seen.has(row.id)); seen.add(row.id); }
    return DEFINITIONS.map(d => {
      const row = value.methods.find(item => item.id === d.id);
      need(row && row.network === d.network && row.asset === d.asset && d.states.includes(row.readiness) &&
        row.selectable === true && row.executable === false && row.settlement_enabled === false &&
        row.execution_authorized === false && row.collection_activated === false &&
        row.principal_destination === PRINCIPAL && row.account_role === 'PLATFORM_FEE_ONLY' &&
        typeof row.connection_installed === 'boolean');
      let account = d.account;
      const fee = row.fee_destination;
      if (d.id === 'card') {
        need(typeof row.testnet === 'boolean' && (row.mode === null || row.mode === 'live' || row.mode === 'test'));
        need(row.testnet === (row.mode === 'test'));
        need(row.readiness === 'TEST_ONLY' ? row.mode === 'test' && row.connection_installed :
          row.readiness === 'CONFIGURED_UNVERIFIED' ? row.mode === 'live' && row.connection_installed : !row.connection_installed);
        if (fee !== null) {
          need(plain(fee) && fee.network === 'stripe' && fee.account === PLATFORM_ACCOUNT &&
            fee.asset === d.asset && fee.purpose === 'PLATFORM_FEE_ONLY' &&
            fee.seller_principal_destination === false && fee.collection_activated === false);
          account = fee.account;
        } else need(row.connection_installed === false);
      } else {
        need(row.testnet === d.testnet && plain(fee) && fee.network === d.network && fee.account === d.account &&
          fee.asset === d.asset && fee.testnet === d.testnet && fee.purpose === 'PLATFORM_FEE_ONLY' &&
          fee.seller_principal_destination === false && fee.collection_activated === false);
        if (row.readiness === 'CONFIGURED_UNVERIFIED') need(row.connection_installed === true);
        if (row.readiness === 'NOT_CONNECTED' || row.readiness === 'NOT_LIVE') need(row.connection_installed === false);
      }
      return {...d, steps:d.steps.slice(), states:d.states.slice(), readiness:row.readiness,
        readinessLabel:LABELS[row.readiness], connectionInstalled:row.connection_installed,
        feeAccount:account, source:'host'};
    });
  }
  function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function renderOptions(rows) {
    need(Array.isArray(rows) && rows.length === DEFINITIONS.length);
    return ['Payment choices','Test networks','Future network'].map(group => {
      const selected = rows.filter(row => row.group === group);
      return '<section class="payment-group"><h2>'+escape(group)+'</h2>'+selected.map(row => {
        const fee = row.id === 'aap-native' ? '<p><strong>Recorded treasury:</strong> treasury. No live payment address.</p>' :
          row.feeAccount === null ? '<p><strong>Covenant fee destination:</strong> not connected.</p>' :
          '<p><strong>Covenant fee destination only:</strong> <span class="payment-address">'+escape(row.feeAccount)+'</span></p>';
        return '<details class="payment-choice" data-payment-method="'+escape(row.id)+'"><summary>'+escape(row.label)+
          '<span class="payment-readiness">'+escape(row.readinessLabel)+'</span></summary><div class="payment-detail">'+
          '<p><strong>Network:</strong> '+escape(row.network)+' · '+escape(row.asset==='EXACT_ADOPTED_FIAT_CURRENCY'?'agreed card currency':row.asset)+'</p>'+
          '<ol>'+row.steps.map(step => '<li>'+escape(step)+'</li>').join('')+'</ol>'+fee+
          (row.id==='aap-native'?'':'<p>The seller’s payment goes to the seller’s separately approved destination. Do not send the order price to the Covenant fee destination.</p>')+
          '</div></details>';
      }).join('')+'</section>';
    }).join('');
  }
  async function loadCatalog(fetcher) {
    need(typeof fetcher === 'function');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const response = await fetcher(METHODS_URL, {method:'GET', mode:'cors', credentials:'omit', cache:'no-store',
        redirect:'error', headers:{Accept:'application/json'}, signal:controller?controller.signal:undefined});
      need(response && response.ok === true);
      const raw = await response.text(); need(typeof raw === 'string' && raw.length <= 65536);
      const envelope = JSON.parse(raw);
      need(plain(envelope) && envelope.ok === true);
      return inspectCatalog(envelope.result);
    } finally { if (timer !== null) clearTimeout(timer); }
  }
  const api = {ORIGIN, METHODS_URL, VERSION, fallback, inspectCatalog, renderOptions, loadCatalog};
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.AAPPaymentOptions = api;
  if (typeof document === 'undefined') return;
  const choices = document.getElementById('payment-choices');
  const status = document.getElementById('payment-status');
  const retry = document.getElementById('payment-retry');
  if (!choices || !status || !retry) return;
  choices.innerHTML = renderOptions(fallback());
  let busy = false;
  async function refresh() {
    if (busy) return;
    busy = true; retry.disabled = true;
    status.textContent = 'Checking the hosted payment connections…';
    const opened = Array.from(choices.querySelectorAll('details[open]'), el => el.dataset.paymentMethod);
    try {
      const rows = await loadCatalog(global.fetch.bind(global));
      choices.innerHTML = renderOptions(rows);
      for (const detail of choices.querySelectorAll('details')) detail.open = opened.includes(detail.dataset.paymentMethod);
      status.textContent = 'Connection list received. Choose a method below to see what your deal needs. This page does not send a payment.';
    } catch (_) {
      // A failed refresh must not leave an earlier connection claim looking
      // current. Keep the choices, while returning to the saved setup states.
      choices.innerHTML = renderOptions(fallback());
      for (const detail of choices.querySelectorAll('details')) detail.open = opened.includes(detail.dataset.paymentMethod);
      status.textContent = 'The hosted payment connections are not available to this page yet. The saved choices below are still visible. Check the service status or try again.';
    } finally { busy = false; retry.disabled = false; }
  }
  retry.addEventListener('click', refresh);
  refresh();
})(typeof globalThis === 'object' ? globalThis : this);
