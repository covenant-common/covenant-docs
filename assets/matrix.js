/* Public-only Matrix client. No credentials, local storage, signing or payment. */
'use strict';
(() => {
  const ENDPOINT = 'https://virtual-limited-tribune-deutsch.trycloudflare.com/mcp';
  const PUBLIC_ORIGIN = new URL(ENDPOINT).origin;
  const PROTOCOL = '2025-11-25';
  const MAX_REPLY = 524288;
  const $ = (id) => document.getElementById(id);
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  let requestId = 0;
  let initialization = null;
  let downloadUrl = null;
  let nextOffset = null;
  let currentSearch = {query: '', category: ''};
  const displayed = new Set();

  const tabs = Array.from(document.querySelectorAll('#matrix-tabs [role="tab"]'));
  function selectPanel(name, focus = false) {
    const selected = tabs.find((tab) => tab.id === 'tab-' + name);
    if (!selected) return;
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute('aria-controls')).hidden = !active;
    });
    if (focus) selected.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPanel(tab.id.slice(4)));
    tab.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        selectPanel(tabs[target].id.slice(4), true);
      }
    });
  });
  document.querySelectorAll('[data-panel]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      selectPanel(link.dataset.panel, true);
      $('matrix-tabs').scrollIntoView({block: 'start'});
    });
  });
  function panelFromHash() {
    const hash = window.location.hash;
    if (hash === '#panel-system' || hash.startsWith('#route-')) selectPanel('system');
    else if (hash === '#panel-creations') selectPanel('creations');
    else if (hash === '#panel-market') selectPanel('market');
  }
  selectPanel('market');
  panelFromHash();
  window.addEventListener('hashchange', panelFromHash);
  $('matrix-depth').addEventListener('change', (event) => {
    const depth = Number(event.target.value);
    document.querySelectorAll('details[data-depth]').forEach((item) => {
      item.open = Number(item.dataset.depth) <= depth;
    });
  });
  document.querySelectorAll('[data-query]').forEach((button) => {
    button.addEventListener('click', () => {
      $('market-query').value = button.dataset.query;
      $('market-query').focus();
      $('market-state').textContent = 'Search suggestion filled. Choose Search listings to send it.';
    });
  });

  async function replyText(response) {
    const size = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(size) && size > MAX_REPLY) throw new Error('The public response is too large. Try a narrower search.');
    if (!response.body || typeof response.body.getReader !== 'function') {
      const text = await response.text();
      if (new TextEncoder().encode(text).length > MAX_REPLY) throw new Error('The public response is too large.');
      return text;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_REPLY) throw new Error('The public response is too large. Try a narrower search.');
        chunks.push(part.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const all = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {all.set(chunk, offset); offset += chunk.byteLength;});
    return new TextDecoder('utf-8', {fatal: true}).decode(all);
  }
  async function rpc(method, params, initial = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const id = ++requestId;
    const headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'};
    if (!initial) headers['MCP-Protocol-Version'] = PROTOCOL;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
        headers, body: JSON.stringify({jsonrpc: '2.0', id, method, params})
      });
      if (response.status === 429) throw new Error('The pilot is busy. Wait a minute before trying again.');
      if (!response.ok) throw new Error('The temporary service could not complete this request (HTTP ' + response.status + '). Check the API and MCP guide.');
      const value = JSON.parse(await replyText(response));
      if (!isObject(value) || value.jsonrpc !== '2.0' || value.id !== id) throw new Error('The service returned an unexpected reply. No result has been accepted.');
      if (value.error || !isObject(value.result)) throw new Error('The service refused the request. Check the published operation and connection instructions.');
      return value.result;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('The temporary service did not reply in time. It may be offline. No automatic retry was made.');
      if (error instanceof TypeError) throw new Error('The temporary endpoint could not be reached from this page. Check its availability in the API and MCP guide; stable hosting is pending.');
      if (error instanceof SyntaxError) throw new Error('The service did not return valid JSON. No result has been accepted.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function callTool(name, args) {
    if (!initialization) {
      initialization = rpc('initialize', {
        protocolVersion: PROTOCOL, capabilities: {},
        clientInfo: {name: 'covenant-haris-matrix', version: '1.0'}
      }, true).then((result) => {
        if (result.protocolVersion !== PROTOCOL) throw new Error('The service selected an unsupported protocol version.');
      }).catch((error) => {initialization = null; throw error;});
    }
    await initialization;
    const result = await rpc('tools/call', {name, arguments: args});
    if (!Array.isArray(result.content) || result.content.length !== 1 || result.content[0].type !== 'text' || typeof result.content[0].text !== 'string') {
      throw new Error('The tool returned an unexpected result format.');
    }
    const raw = result.content[0].text;
    let data;
    try {data = JSON.parse(raw);} catch (_) {throw new Error('The tool did not return a JSON record.');}
    if (result.isError === true) {
      const code = isObject(data) && typeof data.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(data.code) ? ' (' + data.code + ')' : '';
      throw new Error('The tool refused this request' + code + '. Review the input or use the API and MCP guide.');
    }
    return {data, raw};
  }
  function text(tag, value, parent) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (parent) parent.appendChild(node);
    return node;
  }
  function safePublicationUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.origin === PUBLIC_ORIGIN && url.pathname.startsWith('/marketplace/') && !url.username && !url.password ? url.href : null;
    } catch (_) {return null;}
  }
  function resourceNames(fields) {
    if (!Array.isArray(fields.offer)) return '';
    const names = [];
    fields.offer.forEach((leg) => {
      if (!isObject(leg) || !isObject(leg.asset)) return;
      ['namespace', 'identifier', 'unit'].forEach((key) => {
        if (typeof leg.asset[key] === 'string') names.push(leg.asset[key]);
      });
    });
    return names.join(' · ');
  }
  function listingCard(publication) {
    const fields = publication.fields;
    const article = document.createElement('article');
    text('h3', typeof fields.title === 'string' ? fields.title : 'Untitled public listing', article);
    const summary = ['summary', 'description'].map((key) => typeof fields[key] === 'string' ? fields[key] : '').filter(Boolean).join(' ');
    if (summary) text('p', summary, article);
    if (typeof fields.category === 'string') text('p', 'Category: ' + fields.category, article);
    const resources = resourceNames(fields);
    if (resources) text('p', 'Offered resources: ' + resources, article);
    const url = safePublicationUrl(publication.url);
    if (url) {const link = text('a', 'Open the public advert', article); link.href = url;}
    const details = document.createElement('details');
    text('summary', 'Public record and identifier', details);
    text('p', 'Publication ID: ' + publication.id, details);
    text('pre', JSON.stringify(publication, null, 2), details);
    article.appendChild(details);
    return article;
  }
  function searchState(message) {
    $('market-state').textContent = message;
    $('creations-state').textContent = message + ' This shared view contains public service listings only.';
  }
  let searching = false;
  async function search(append = false) {
    if (searching) return;
    let selected;
    if (append) selected = {...currentSearch, offset: nextOffset};
    else {
      const query = $('market-query').value.trim();
      const category = $('market-category').value.trim();
      if (query.length > 120 || query.split(/\s+/).filter(Boolean).length > 8 || category.length > 64) {
        searchState('Use up to eight search words, at most 120 characters, and a category of at most 64 characters.');
        return;
      }
      currentSearch = {query, category};
      selected = {...currentSearch, offset: 0};
      displayed.clear();
      $('market-results').replaceChildren();
      $('creations-results').replaceChildren();
    }
    if (append && !Number.isSafeInteger(selected.offset)) return;
    searching = true;
    $('market-search-button').disabled = true;
    $('market-more').disabled = true;
    $('market-more').hidden = true;
    searchState('Loading current public listings…');
    try {
      const {data} = await callTool('aap_public_listing_search', {...selected, limit: 5});
      const result = isObject(data) ? data.result : null;
      if (!isObject(result) || !Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0 || result.scope !== 'CURRENT_INDEXED_PUBLICATIONS_ONLY') {
        throw new Error('The service returned an unexpected listing response. No inventory total has been accepted.');
      }
      const categories = new Set(Array.from($('market-categories').children).map((option) => option.value));
      result.items.forEach((item) => {
        const publication = isObject(item) ? item.publication : null;
        if (!isObject(publication) || !isObject(publication.fields) || typeof publication.id !== 'string' || !/^[0-9a-f]{64}$/.test(publication.id) || publication.visibility !== 'INDEXED') {
          throw new Error('An unexpected publication record was returned. No private or unlisted record has been accepted.');
        }
        if (displayed.has(publication.id)) return;
        displayed.add(publication.id);
        $('market-results').appendChild(listingCard(publication));
        $('creations-results').appendChild(listingCard(publication));
        if (typeof publication.fields.category === 'string' && !categories.has(publication.fields.category)) {
          categories.add(publication.fields.category);
          const option = document.createElement('option');
          option.value = publication.fields.category;
          $('market-categories').appendChild(option);
        }
      });
      nextOffset = Number.isSafeInteger(result.next_offset) && result.next_offset >= 0 && result.next_offset <= 5000 ? result.next_offset : null;
      $('market-more').hidden = nextOffset === null;
      const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
      searchState(result.total === 0 ? 'No public listings matched this search. Be among the first to advertise a service. Checked ' + stamp + '.' : displayed.size + ' displayed; ' + result.total + ' matched this public search. Checked ' + stamp + '. Listings can change between pages.');
    } catch (error) {
      nextOffset = null;
      const kept = displayed.size ? ' Previously loaded results remain below; they have not been refreshed. ' : '';
      searchState('Public search did not complete. ' + kept + error.message);
    } finally {
      searching = false;
      $('market-search-button').disabled = false;
      $('market-more').disabled = false;
    }
  }
  $('market-search').addEventListener('submit', (event) => {event.preventDefault(); search(false);});
  $('market-more').addEventListener('click', () => search(true));

  let drafting = false;
  $('matrix-draft').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (drafting || !event.currentTarget.reportValidity()) return;
    const values = {};
    ['title', 'buyer', 'supplier', 'deliverable', 'price'].forEach((key) => {values[key] = $('draft-' + key).value.trim();});
    if (Object.values(values).some((value) => !value)) {$('draft-state').textContent = 'Fill in each field before preparing the draft.'; return;}
    if (values.buyer === values.supplier) {$('draft-state').textContent = 'Give the buyer and supplier distinct names or public identifiers.'; return;}
    drafting = true;
    $('draft-submit').disabled = true;
    $('draft-result').hidden = true;
    $('draft-state').textContent = 'Sending these terms for an unsigned draft…';
    try {
      const {data, raw} = await callTool('covenant_contract__draft', {
        title: values.title, parties: [values.buyer, values.supplier],
        clauses: [
          {id: 'scope', title: 'Work and review', text: values.deliverable},
          {id: 'exchange', title: 'Price or exchange', text: values.price},
          {id: 'approval', title: 'Approval', text: 'This is an unsigned draft. Approval, acceptance, payment and any dispute procedure still need to be agreed by the participants.'}
        ]
      });
      if (!isObject(data) || typeof data.id !== 'string' || !/^[0-9a-f]{64}$/.test(data.id) || data.status !== 'UNSIGNED_DRAFT' || data.binding !== false || !isObject(data.draft)) {
        throw new Error('The service did not return the expected unsigned draft. No signing or payment has been performed by this page.');
      }
      $('draft-id').textContent = data.id;
      $('draft-json').textContent = raw;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(new Blob([raw], {type: 'application/json;charset=utf-8'}));
      $('draft-download').href = downloadUrl;
      $('draft-download').download = 'covenant-unsigned-' + data.id.slice(0, 12) + '.json';
      $('draft-result').hidden = false;
      $('draft-state').textContent = 'Unsigned draft prepared. Review every term; nothing has been signed, published or paid.';
    } catch (error) {
      $('draft-state').textContent = 'Drafting did not complete. ' + error.message + ' Your input remains in the form; no automatic retry was made.';
    } finally {
      drafting = false;
      $('draft-submit').disabled = false;
    }
  });
  window.addEventListener('pagehide', () => {if (downloadUrl) URL.revokeObjectURL(downloadUrl);});
  $('market-search-button').disabled = false;
  $('draft-submit').disabled = false;
  search(false);
})();
