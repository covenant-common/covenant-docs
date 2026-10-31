/* Public-only Matrix client. No credentials, local storage, signing or payment. */
'use strict';
(() => {
  const ENDPOINT = 'https://jupie202020.pythonanywhere.com/mcp';
  const PUBLIC_ORIGIN = new URL(ENDPOINT).origin;
  const PROTOCOL = '2025-11-25';
  const MAX_REPLY = 524288;
  const $ = (id) => document.getElementById(id);
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  let requestId = 0;
  let initialization = null;
  let downloadUrl = null;
  let handoffUrl = null;
  let latestHandoffText = null;
  let keywordNeed = null;
  let searchNotice = '';
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
      if (!response.ok) throw new Error('The hosted pilot could not complete this request (HTTP ' + response.status + '). Check the API and MCP guide.');
      const value = JSON.parse(await replyText(response));
      if (!isObject(value) || value.jsonrpc !== '2.0' || value.id !== id) throw new Error('The service returned an unexpected reply. No result has been accepted.');
      if (value.error || !isObject(value.result)) throw new Error('The service refused the request. Check the published operation and connection instructions.');
      return value.result;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('The hosted pilot did not reply in time. It may be unavailable. No automatic retry was made.');
      if (error instanceof TypeError) throw new Error('The hosted endpoint could not be reached from this page. Check its availability and connection instructions in the API and MCP guide.');
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
      if (isObject(data) && data.code === 'HOSTED_API_NOT_FOUND') throw new Error('There is no accessible current record for this request. Search for a fresh public version or check the identifier and your access. This response does not establish why a record is absent or whether any private record exists.');
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
    const arrange = text('button', 'Structure this deal', article); arrange.type = 'button'; arrange.disabled = !window.AAPDealStructures;
    const arrangeState = text('p', '', article); arrangeState.setAttribute('role', 'status'); arrangeState.setAttribute('aria-live', 'polite');
    arrange.addEventListener('click', () => {
      try {selectAdvert(window.AAPDealStructures.advertFromPublication(publication)); $('draft-work').scrollIntoView({block: 'start'}); $('draft-structure').focus();}
      catch (error) {arrangeState.textContent = 'This advert could not be copied into the simple composer: ' + error.message + ' It has not been removed. '; const fallback = text('a', url ? 'Open the original advert' : 'See advanced agreement options', arrangeState); fallback.href = url || 'CAPABILITIES.html#agreements';}
    });
    const details = document.createElement('details');
    text('summary', 'Public record and identifier', details);
    text('p', 'Publication ID: ' + publication.id, details);
    if (window.AAPDealStructures) {
      try {text('pre', JSON.stringify(window.AAPDealStructures.advertFromPublication(publication), null, 2), details);}
      catch (_) {text('p', 'Open the original public advert for the complete publication.', details);}
    }
    article.appendChild(details);
    return article;
  }
  function searchState(message) {
    $('market-state').textContent = message + (searchNotice ? ' ' + searchNotice : '');
    $('creations-state').textContent = message + (searchNotice ? ' ' + searchNotice : '') + ' This shared view contains public service listings only.';
  }
  let searching = false;
  async function search(append = false) {
    if (searching) return;
    let selected;
    if (append) selected = {...currentSearch, offset: nextOffset};
    else {
      const original = $('market-query').value;
      const edited = keywordNeed === original && !$('market-keyword-assist').hidden;
      if (!edited) $('market-keyword-assist').hidden = true;
      const normalised = structures.normalizeServiceQuery(edited ? $('market-keywords').value : original, {literal: edited});
      const query = normalised.query; searchNotice = normalised.notice;
      const category = $('market-category').value.trim();
      if (normalised.requires_edit) {keywordNeed = original; $('market-keyword-assist').hidden = false; $('market-keywords').value = query; searchState('Your original need stays above. Edit the keywords below, then search again.'); $('market-keywords').focus(); return;}
      if (category.length > 64) {searchState('Use a category of at most 64 characters.'); return;}
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
  $('market-query').addEventListener('input', () => {keywordNeed = null; $('market-keyword-assist').hidden = true;});
  $('market-search').addEventListener('submit', (event) => {event.preventDefault(); search(false);});
  $('market-more').addEventListener('click', () => search(true));

  const structures = window.AAPDealStructures;
  const selection = structures ? new structures.SelectionSession() : null;
  let templatePreview = 0;
  let drafting = false;
  let latestDraftRaw = null;
  function clearDraftOutput(message) {
    latestDraftRaw = null; latestHandoffText = null;
    $('draft-review').replaceChildren();
    $('proposal-copy').disabled = true;
    $('proposal-copy-state').textContent = '';
    $('proposal-handoff-details').open = false;
    $('proposal-handoff-text').textContent = '';
    $('proposal-download').removeAttribute('href');
    $('proposal-download').removeAttribute('download');
    if (handoffUrl) {URL.revokeObjectURL(handoffUrl); handoffUrl = null;}
    $('draft-result').hidden = true;
    $('draft-copy').disabled = true;
    $('draft-copy-state').textContent = '';
    $('draft-json-details').open = false;
    $('draft-json').textContent = '';
    $('draft-id').textContent = '';
    $('draft-download').removeAttribute('href');
    $('draft-download').removeAttribute('download');
    if (downloadUrl) {URL.revokeObjectURL(downloadUrl); downloadUrl = null;}
    if (message) $('draft-state').textContent = message;
  }
  function invalidateDraft(message) {
    if (selection) selection.invalidate();
    clearDraftOutput(message || 'Terms changed. Prepare a fresh unsigned draft when ready.');
  }
  async function showTemplate() {
    if (!structures) return;
    const id = $('draft-structure').value, chosen = structures.template(id), ticket = ++templatePreview;
    $('structure-description').textContent = chosen.description + ' This records proposed terms. It does not start work or release payment.';
    $('structure-details-label').textContent = chosen.details_label;
    $('draft-structure-details').required = chosen.requires_details;
    $('specialist-ack-label').hidden = !chosen.specialist;
    $('specialist-ack').checked = false;
    $('structure-hash').textContent = 'Computing the exact template snapshot hash…';
    $('structure-snapshot').textContent = JSON.stringify(chosen, null, 2);
    try {
      const pin = await structures.templatePin(id);
      if (ticket === templatePreview) $('structure-hash').textContent = 'Revision ' + chosen.revision + ' · SHA-256 ' + pin.hash + ' · template digest only, not a source-offer pin';
    } catch (error) {if (ticket === templatePreview) $('structure-hash').textContent = error.message;}
  }
  function selectAdvert(advert) {
    if (!selection) throw new Error('The shared structure catalogue could not load.');
    selection.select(advert);
    clearDraftOutput('Advert selection changed. Review the proposed terms before preparing a fresh draft.');
    if (advert === null) {
      $('selected-advert-state').textContent = 'No advert selected. You can structure a deal without a listing.';
      $('clear-advert').hidden = true;
      return;
    }
    const values = structures.proposedFields(advert);
    ['title', 'deliverable', 'price'].forEach((key) => {$('draft-' + key).value = values[key];});
    $('draft-supplier').value = '';
    $('selected-advert-state').textContent = 'Selected advert: ' + advert.snapshot.title + '. This copies publicly displayed text; the exact original offer has not been checked. Confirm both parties and check that offer before signing.';
    $('clear-advert').hidden = false;
  }
  if (structures) {
    $('draft-structure').replaceChildren();
    structures.catalogue().forEach((item) => {const option = document.createElement('option'); option.value = item.id; option.textContent = item.title; $('draft-structure').appendChild(option);});
    $('draft-structure').disabled = false;
    const requested = new URL(window.location.href).searchParams.get('structure');
    if (requested && structures.catalogue().some((item) => item.id === requested)) $('draft-structure').value = requested;
    $('draft-structure').addEventListener('change', () => {invalidateDraft(); showTemplate();});
    $('matrix-draft').addEventListener('input', () => invalidateDraft());
    $('clear-advert').addEventListener('click', () => selectAdvert(null));
    async function loadHandoff(raw) {
      const revision = selection.invalidate();
      clearDraftOutput('Loading a public handoff locally; no request has been sent.');
      const advert = await structures.readHandoff(raw);
      if (!selection.accepts(revision)) throw new Error('The selection changed while loading. Choose the handoff again.');
      selectAdvert(advert);
      $('advert-handoff-state').textContent = 'Public advert handoff loaded. Its file hash checks integrity only; source provenance remains unverified.';
    }
    $('advert-handoff-file').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      invalidateDraft('A new handoff file was chosen. The earlier draft is no longer current.');
      try {if (file.size > 65536) throw new Error('Choose a public handoff of at most 64 KiB.'); await loadHandoff(await file.text());}
      catch (error) {$('advert-handoff-state').textContent = 'The handoff was not loaded: ' + error.message;}
    });
    $('load-advert-handoff').addEventListener('click', async () => {
      try {await loadHandoff($('advert-handoff-text').value);}
      catch (error) {$('advert-handoff-state').textContent = 'The handoff was not loaded: ' + error.message;}
    });
    showTemplate();
  } else $('draft-state').textContent = 'The shared structure catalogue could not load. Use the direct MCP connection guide or reload this page.';
  function renderDraftReview(review) {
    const target = $('draft-review'); target.replaceChildren();
    text('h3', 'Review the returned proposal', target);
    text('p', review.title, target);
    text('p', 'Requesting party: ' + review.parties[0], target);
    text('p', 'Performing party: ' + review.parties[1], target);
    review.clauses.forEach((clause) => {const section = document.createElement('section'); text('h4', clause.title, section); text('p', clause.text, section); target.appendChild(section);});
    if (review.conditions.length) {text('h4', 'Additional stated conditions', target); review.conditions.forEach((condition) => text('p', typeof condition === 'string' ? condition : JSON.stringify(condition), target));}
    text('h4', 'Choices still to discuss', target);
    if (review.missing.length) {const list = document.createElement('ul'); review.missing.forEach((item) => text('li', item, list)); target.appendChild(list);}
    else text('p', 'Review the stated settlement and disagreement arrangements with the other party.', target);
    if (review.source) text('p', 'Referenced advert: ' + review.source.title + '. Its exact source offer has not been verified.', target);
    text('p', review.boundary, target);
  }
  $('proposal-copy').addEventListener('click', async () => {
    const value = latestHandoffText;
    if (drafting || value === null) return;
    $('proposal-copy').disabled = true; $('proposal-copy-state').textContent = '';
    try {if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); if (!drafting && latestHandoffText === value) $('proposal-copy-state').textContent = 'Copied the cover note and exact unsigned draft attachment. Choose your own sharing channel; nothing was sent.';}
    catch (_) {if (!drafting && latestHandoffText === value) {$('proposal-handoff-details').open = true; $('proposal-handoff-text').focus(); $('proposal-copy-state').textContent = 'Clipboard access was unavailable. Select and copy the proposal handoff below.';}}
    finally {$('proposal-copy').disabled = drafting || latestHandoffText === null;}
  });
  $('draft-copy').addEventListener('click', async () => {
    const raw = latestDraftRaw;
    if (drafting || raw === null) return;
    $('draft-copy').disabled = true;
    $('draft-copy-state').textContent = '';
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(raw);
      if (!drafting && latestDraftRaw === raw) $('draft-copy-state').textContent = 'Copied the exact unsigned draft JSON.';
    } catch (_) {
      if (!drafting && latestDraftRaw === raw) {
        $('draft-json-details').open = true;
        $('draft-copy-state').textContent = 'Clipboard access was unavailable. The exact JSON is open below; select and copy it manually.';
        $('draft-json').focus();
      }
    } finally {$('draft-copy').disabled = drafting || latestDraftRaw === null;}
  });
  $('matrix-draft').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!structures || !selection || drafting || !event.currentTarget.reportValidity()) return;
    const values = {};
    ['title', 'buyer', 'supplier', 'deliverable', 'price'].forEach((key) => {values[key] = $('draft-' + key).value.trim();});
    const input = {template_id: $('draft-structure').value, fields: values,
      details: $('draft-structure-details').value, selected_advert: selection.advert,
      specialist_acknowledged: $('specialist-ack').checked};
    const revision = selection.capture();
    drafting = true; $('draft-submit').disabled = true;
    clearDraftOutput('Preparing the chosen structure and advert reference…');
    try {
      const prepared = await structures.buildDraft(input);
      if (!selection.accepts(revision)) throw new Error('Terms changed before sending. Prepare the current terms again.');
      $('draft-state').textContent = 'Sending the proposed terms and exact template snapshot for an unsigned draft…';
      const {data, raw} = await callTool('covenant_contract__draft', prepared.request);
      if (!selection.accepts(revision)) throw new Error('Terms or selection changed while drafting. The earlier reply was not accepted; prepare the current terms again.');
      if (!isObject(data) || typeof data.id !== 'string' || !/^[0-9a-f]{64}$/.test(data.id) || data.status !== 'UNSIGNED_DRAFT' || data.binding !== false || data.execution_authorized !== false || !structures.responseRetains(prepared.request, data)) {
        throw new Error('The service did not preserve the exact structure and advert reference in an unsigned draft. No result has been accepted.');
      }
      const review = structures.reviewDraft(prepared.request, data);
      const handoff = structures.proposalHandoff(prepared.request, data, raw);
      selection.retain(revision, raw);
      renderDraftReview(review);
      latestHandoffText = handoff; $('proposal-handoff-text').textContent = handoff; $('proposal-copy').disabled = false;
      handoffUrl = URL.createObjectURL(new Blob([structures.proposalHandoffHTML(prepared.request, data, raw)], {type: 'text/html;charset=utf-8'}));
      $('proposal-download').href = handoffUrl; $('proposal-download').download = 'covenant-proposal-handoff-' + data.id.slice(0, 12) + '.html';
      $('draft-id').textContent = data.id; $('draft-json').textContent = raw;
      latestDraftRaw = raw; $('draft-copy').disabled = false;
      downloadUrl = URL.createObjectURL(new Blob([raw], {type: 'application/json;charset=utf-8'}));
      $('draft-download').href = downloadUrl;
      $('draft-download').download = 'covenant-unsigned-' + data.id.slice(0, 12) + '.json';
      $('draft-result').hidden = false;
      $('draft-state').textContent = 'Unsigned proposal prepared. Review the returned terms below. It retains the chosen structure' + (selection.advert ? ' and advert reference. Check the exact original offer before signing.' : '; no advert was selected.') + ' Both parties’ approval remains separate; nothing has been signed, published or paid.';
    } catch (error) {$('draft-state').textContent = 'Drafting did not complete: ' + error.message + ' Your input remains; no automatic retry was made.';}
    finally {drafting = false; $('draft-submit').disabled = false;}
  });
  window.addEventListener('pagehide', () => {if (downloadUrl) URL.revokeObjectURL(downloadUrl); if (handoffUrl) URL.revokeObjectURL(handoffUrl);});
  $('market-search-button').disabled = false;
  $('draft-submit').disabled = !structures;
  search(false);
})();
