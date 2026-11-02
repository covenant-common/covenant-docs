/* Offline owner approval for one hosted advert. No network, storage or general signer.
 * Validation mirrors clients/approve_listing.py; Ed25519 import uses trial-client.js.
 * Browser-selected files do not provide the CLI's POSIX file-permission guarantees. */
(function (global) {
  'use strict';
  const ORIGIN = 'https://jupie202020.pythonanywhere.com';
  const LABEL = 'COVENANT-PUBLIC-WEB-0.1';
  const ITEM_LABEL = 'COVENANT-PUBLIC-WEB-ITEM-0.1';
  const PROFILE = 'covenant-public-web/0.1';
  const ACCESS_VERSION = 'aap-private-trial-client/0.1';
  const ADVERT_DRAFT_PROFILE = 'urn:aap:hosted-advert-draft:0.1';
  const BODY_FIELDS = ['version','origin','id','kind','source','principals','sequence','previous','visibility','fields','links','expires'];
  const PREVIEW_FIELDS = ['id','body','required_signers','signing_label','url','available_fields','preview','execution_authorized','published'];
  const ACCESS_FIELDS = ['version','origin','actor','private_seed','token','client_nonce','challenge','signature','grant'];
  const METADATA = ['origin','source hash/type','signing identities','revision','visibility','expiry','explicit links','consent signatures'];
  const encoder = new TextEncoder();
  class Refused extends Error { constructor(code) { super(code); this.name = 'Refused'; } }
  const need = (value, code) => { if (!value) throw new Refused(code); };
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hexKey = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  const integer = (value, positive = false) => Number.isSafeInteger(value) && value >= (positive ? 1 : 0);
  const ascii = value => !/[^\x20-\x7e]/.test(value);
  const hex = bytes => Array.from(bytes, part => part.toString(16).padStart(2, '0')).join('');
  const unhex = value => Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
  const equal = (left, right) => canonical(left) === canonical(right);
  function shape(value, fields, code) {
    need(record(value) && Object.keys(value).sort().join('\0') === fields.slice().sort().join('\0'), code);
  }
  function canonical(value) {
    const pending = [[value, 0]];
    let visited = 0;
    while (pending.length) {
      const [part, depth] = pending.pop();
      need(depth <= 40 && ++visited <= 20000, 'JSON_BOUNDS');
      if (part === null || typeof part === 'boolean') continue;
      if (typeof part === 'number') need(Number.isSafeInteger(part), 'JSON_INTEGER');
      else if (typeof part === 'string') need(part.length <= 100000 && ascii(part), 'JSON_ASCII');
      else if (Array.isArray(part)) {
        need(part.length <= 20000, 'JSON_BOUNDS');
        for (const item of part) pending.push([item, depth + 1]);
      } else if (record(part)) {
        const keys = Object.keys(part);
        need(keys.length <= 20000, 'JSON_BOUNDS');
        for (const key of keys) {
          need(key.length <= 256 && ascii(key), 'JSON_KEY');
          pending.push([part[key], depth + 1]);
        }
      } else throw new Refused('JSON_TYPE');
    }
    function encode(part) {
      if (Array.isArray(part)) return '[' + part.map(encode).join(',') + ']';
      if (record(part)) return '{' + Object.keys(part).sort().map(key => JSON.stringify(key) + ':' + encode(part[key])).join(',') + '}';
      return JSON.stringify(part);
    }
    return encode(value);
  }
  function rawBytes(raw, maximum) {
    need(raw instanceof Uint8Array && raw.byteLength > 0 && raw.byteLength <= maximum, 'INPUT_SIZE');
    return raw;
  }
  function decode(raw, maximum) {
    rawBytes(raw, maximum);
    let text;
    try { text = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(raw); }
    catch (_) { throw new Refused('JSON_INVALID'); }
    let at = 0, visited = 0;
    const whitespace = () => { while (at < text.length && /[\x20\t\r\n]/.test(text[at])) at++; };
    function string() {
      need(text[at] === '"', 'JSON_INVALID');
      const start = at++;
      let escaped = false;
      while (at < text.length) {
        const character = text[at++];
        if (character === '"' && !escaped) {
          try { return JSON.parse(text.slice(start, at)); }
          catch (_) { throw new Refused('JSON_INVALID'); }
        }
        if (character === '\\' && !escaped) escaped = true;
        else escaped = false;
      }
      throw new Refused('JSON_INVALID');
    }
    function value(depth) {
      need(depth <= 40 && ++visited <= 20000, 'JSON_BOUNDS');
      whitespace();
      const character = text[at];
      if (character === '"') return string();
      if (character === '{') {
        at++; whitespace();
        const result = Object.create(null);
        if (text[at] === '}') { at++; return result; }
        let count = 0;
        while (true) {
          whitespace();
          const key = string();
          need(!Object.prototype.hasOwnProperty.call(result, key), 'JSON_DUPLICATE_KEY');
          need(++count <= 20000, 'JSON_BOUNDS');
          whitespace(); need(text[at++] === ':', 'JSON_INVALID');
          result[key] = value(depth + 1);
          whitespace();
          if (text[at] === '}') { at++; return result; }
          need(text[at++] === ',', 'JSON_INVALID');
        }
      }
      if (character === '[') {
        at++; whitespace();
        const result = [];
        if (text[at] === ']') { at++; return result; }
        while (true) {
          need(result.length < 20000, 'JSON_BOUNDS');
          result.push(value(depth + 1)); whitespace();
          if (text[at] === ']') { at++; return result; }
          need(text[at++] === ',', 'JSON_INVALID');
        }
      }
      for (const [word, result] of [['true',true],['false',false],['null',null]]) {
        if (text.slice(at, at + word.length) === word) { at += word.length; return result; }
      }
      const matched = /^-?(?:0|[1-9][0-9]*)/.exec(text.slice(at));
      need(matched !== null, 'JSON_INVALID');
      at += matched[0].length;
      need(!/[.eE]/.test(text[at] || ''), 'JSON_NUMBER');
      const result = Number(matched[0]);
      need(Number.isSafeInteger(result), 'JSON_INTEGER');
      return result;
    }
    const result = value(0);
    whitespace(); need(at === text.length, 'JSON_INVALID');
    canonical(result);
    return result;
  }
  function previewValue(value) {
    if (record(value) && Object.prototype.hasOwnProperty.call(value, 'ok')) {
      shape(value, ['version','ok','result'], 'HTTP_ENVELOPE');
      need(value.version === 'urn:aap:hosted-api-http:0.1' && value.ok === true, 'HTTP_ENVELOPE');
      value = value.result;
    }
    if (record(value) && Object.prototype.hasOwnProperty.call(value, 'operation')) {
      shape(value, ['version','operation','result','signing_performed','payment_dispatched','external_execution'], 'PREPARE_RECEIPT');
      need(value.version === 'urn:aap:hosted-api:0.1' && value.operation === 'listing.prepare' && value.signing_performed === false && value.payment_dispatched === false && value.external_execution === false, 'PREPARE_RECEIPT');
      value = value.result;
    }
    if (record(value) && (Object.prototype.hasOwnProperty.call(value, 'source') || Object.prototype.hasOwnProperty.call(value, 'draft_profile'))) {
      shape(value, PREVIEW_FIELDS.concat(['source','draft_profile']), 'PREVIEW_FIELDS');
      need(value.draft_profile === ADVERT_DRAFT_PROFILE, 'ADVERT_DRAFT_PROFILE');
    } else shape(value, PREVIEW_FIELDS, 'PREVIEW_FIELDS');
    return value;
  }
  async function digest(bytes, crypto) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))); }
  async function checkedSourceBinding(prepared, actor, crypto) {
    const source = prepared.source;
    shape(source, ['version','kind','author','title','data','frame','supersedes'], 'ADVERT_SOURCE_FIELDS');
    need(source.version === 'covenant-marketplace/0.1' && source.kind === 'LISTING' && source.author === actor && typeof source.title === 'string' && source.title.length > 0 && source.title.length <= 256 && record(source.frame) && (source.supersedes === null || hexKey(source.supersedes)), 'ADVERT_SOURCE_SHAPE');
    const data = source.data;
    shape(data, ['market','offer','want','mechanism','category','quantity','settlement','archetype','custom','active'], 'ADVERT_SOURCE_FIELDS');
    need(hexKey(data.market) && Array.isArray(data.offer) && Array.isArray(data.want) && typeof data.mechanism === 'string' && data.mechanism.length > 0 && data.mechanism.length <= 128 && typeof data.category === 'string' && data.category.length > 0 && data.category.length <= 128 && integer(data.quantity, true) && record(data.settlement) && record(data.custom) && typeof data.active === 'boolean' && (data.archetype === null || hexKey(data.archetype)), 'ADVERT_SOURCE_SHAPE');
    const sourceHash = await digest(encoder.encode('COVENANT-MARKETPLACE-0.1\0' + canonical(source)), crypto);
    need(prepared.body.source.id === sourceHash, 'ADVERT_SOURCE_HASH');
    const candidates = {title:source.title, record_kind:source.kind, ...data};
    need(equal(prepared.available_fields, Object.keys(candidates).sort()) && Object.keys(prepared.body.fields).every(name => Object.prototype.hasOwnProperty.call(candidates, name) && equal(prepared.body.fields[name], candidates[name])), 'ADVERT_SOURCE_PROJECTION');
    // These are declared-source binding checks, not full native marketplace/frame
    // validation, verified authorship, current authority or external truth.
  }
  async function checkedListing(value, actor, now, crypto) {
    const prepared = previewValue(value);
    need(prepared.signing_label === LABEL && prepared.published === false && prepared.execution_authorized === false, 'PUBLICATION_ONLY');
    const body = prepared.body;
    shape(body, BODY_FIELDS, 'PUBLICATION_BODY');
    need(body.version === PROFILE && body.kind === 'marketplace' && body.origin === ORIGIN, 'PUBLICATION_TARGET');
    shape(body.source, ['type','id'], 'SOURCE_REFERENCE');
    need(body.source.type === 'marketplace-listing' && hexKey(body.source.id), 'LISTING_SOURCE_ONLY');
    const item = await digest(encoder.encode(ITEM_LABEL + '\0' + canonical({origin:ORIGIN, kind:'marketplace', source:body.source})), crypto);
    need(body.id === item && prepared.id === item && prepared.url === ORIGIN + '/marketplace/' + item, 'ITEM_REFERENCE');
    need(equal(body.principals, [actor]) && equal(prepared.required_signers, [actor]), 'SIGNER_MISMATCH');
    need(integer(body.sequence, true) && (body.previous === null || hexKey(body.previous)), 'REVISION');
    need(['PRIVATE','UNLISTED','INDEXED'].includes(body.visibility), 'VISIBILITY');
    need(body.expires === null || integer(body.expires, true) && body.expires > now, 'PUBLICATION_EXPIRED');
    const fields = body.fields;
    need(record(fields) && Object.keys(fields).length >= 1 && Object.keys(fields).length <= 32 && typeof fields.title === 'string' && fields.title.length > 0 && fields.title.length <= 256 && Object.keys(fields).every(name => name.length > 0 && name.length <= 64), 'PUBLIC_FIELDS');
    if (Object.prototype.hasOwnProperty.call(fields, 'record_kind')) need(fields.record_kind === 'LISTING', 'LISTING_SOURCE_ONLY');
    need(Array.isArray(body.links) && body.links.length <= 32 && body.links.every(hexKey) && equal(body.links, Array.from(new Set(body.links)).sort()), 'LINKS');
    const available = prepared.available_fields;
    need(Array.isArray(available) && available.length >= 1 && available.length <= 64 && available.every(name => typeof name === 'string' && name.length > 0 && name.length <= 64) && equal(available, Array.from(new Set(available)).sort()) && Object.keys(fields).every(name => available.includes(name)), 'AVAILABLE_FIELDS');
    const review = prepared.preview;
    shape(review, ['public_fields','public_metadata','indexable','private_source_exported','boundary'], 'PREVIEW_REVIEW');
    need(equal(review.public_fields, fields) && review.indexable === (body.visibility === 'INDEXED') && review.private_source_exported === false && typeof review.boundary === 'string' && review.boundary.length > 0 && review.boundary.length <= 4000 && equal(review.public_metadata, METADATA), 'PREVIEW_REVIEW');
    const wire = canonical(body);
    need(encoder.encode(wire).byteLength <= 64000, 'PUBLICATION_SIZE');
    if (Object.prototype.hasOwnProperty.call(prepared, 'draft_profile')) await checkedSourceBinding(prepared, actor, crypto);
    return {body, wire, message:encoder.encode(LABEL + '\0' + wire)};
  }
  function checkedAccess(value) {
    shape(value, ACCESS_FIELDS, 'TRIAL_ACCESS_FILE');
    need(value.version === ACCESS_VERSION && value.origin === ORIGIN && ['actor','private_seed','token','client_nonce'].every(name => hexKey(value[name])), 'TRIAL_ACCESS_FILE');
  }
  async function ownerKey(access, crypto) {
    // Same seed-to-PKCS8, Ed25519 and JWK-public-key check as trial-client.js.
    const prefix = unhex('302e020100300506032b657004220420');
    const seed = unhex(access.private_seed);
    const pkcs8 = new Uint8Array(prefix.length + seed.length);
    pkcs8.set(prefix); pkcs8.set(seed, prefix.length);
    let jwk;
    try {
      let probe;
      try {
        probe = await crypto.subtle.importKey('pkcs8', pkcs8, {name:'Ed25519'}, true, ['sign']);
        jwk = await crypto.subtle.exportKey('jwk', probe);
      } catch (_) { throw new Refused('ED25519_UNAVAILABLE'); }
      const publicBytes = Uint8Array.from(global.atob(jwk.x.replace(/-/g,'+').replace(/_/g,'/')), character => character.charCodeAt(0));
      need(hex(publicBytes) === access.actor, 'ACCESS_ACTOR_MISMATCH');
      // Retain only a non-extractable signing key during this review.
      return await crypto.subtle.importKey('pkcs8', pkcs8, {name:'Ed25519'}, false, ['sign']);
    } finally {
      seed.fill(0); pkcs8.fill(0);
      if (jwk) { jwk.d = ''; jwk.x = ''; }
    }
  }
  const warning = visibility => ({
    PRIVATE:'PRIVATE keeps this publisher record out of public pages; it is not encrypted storage.',
    UNLISTED:'UNLISTED is readable by anyone with the link; it is not confidential.',
    INDEXED:'INDEXED makes all displayed fields and metadata public and searchable.'
  })[visibility];
  function createSession(crypto, clock = () => Math.floor(Date.now()/1000)) {
    let generation = 0, ready = null;
    function invalidate() { generation++; ready = null; }
    async function prepare(accessRaw, previewRaw) {
      invalidate(); const ticket = generation;
      need(crypto && crypto.subtle, 'ED25519_UNAVAILABLE');
      accessRaw = rawBytes(accessRaw, 32768).slice();
      previewRaw = rawBytes(previewRaw, 262144).slice();
      const access = decode(accessRaw, 32768);
      checkedAccess(access);
      const prepared = decode(previewRaw, 262144);
      const checked = await checkedListing(prepared, access.actor, clock(), crypto);
      const lower = checked.wire.toLowerCase();
      need(!lower.includes(access.private_seed) && !lower.includes(access.token), 'SECRET_IN_PUBLICATION');
      const key = await ownerKey(access, crypto);
      const bodyHash = await digest(checked.message, crypto);
      const accessHash = await digest(accessRaw, crypto), previewHash = await digest(previewRaw, crypto);
      need(ticket === generation, 'INPUT_CHANGED');
      const review = Object.freeze({bodyText:checked.wire, bodyHash, actor:access.actor, signingLabel:LABEL, visibility:checked.body.visibility, visibilityWarning:warning(checked.body.visibility)});
      ready = {key, actor:access.actor, wire:checked.wire, expires:checked.body.expires, accessHash, previewHash, review};
      // Strings/JS engine copies cannot be reliably erased; none is exposed or persisted.
      access.private_seed = null; access.token = null;
      return review;
    }
    async function approve(options) {
      const snapshot = ready, ticket = generation;
      need(snapshot !== null && options && options.reviewed === true, 'APPROVAL_NOT_GIVEN');
      need(options.displayedBody === snapshot.wire, 'REVIEW_CHANGED');
      need(snapshot.expires === null || snapshot.expires > clock(), 'PUBLICATION_EXPIRED');
      rawBytes(options.accessRaw, 32768); rawBytes(options.previewRaw, 262144);
      need(await digest(options.accessRaw, crypto) === snapshot.accessHash && await digest(options.previewRaw, crypto) === snapshot.previewHash, 'INPUT_CHANGED');
      need(ticket === generation && ready === snapshot, 'INPUT_CHANGED');
      need(snapshot.expires === null || snapshot.expires > clock(), 'PUBLICATION_EXPIRED');
      // Consume the consent before the async signature so repeated clicks cannot sign twice.
      ready = null;
      const signature = hex(new Uint8Array(await crypto.subtle.sign('Ed25519', snapshot.key, encoder.encode(LABEL + '\0' + snapshot.wire))));
      need(ticket === generation, 'INPUT_CHANGED');
      need(snapshot.expires === null || snapshot.expires > clock(), 'PUBLICATION_EXPIRED');
      return Object.freeze({signer:snapshot.actor, signature});
    }
    return Object.freeze({prepare, approve, invalidate});
  }
  const api = {ORIGIN,LABEL,ITEM_LABEL,canonical,decode,checkedListing,createSession,Refused};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined' || !document.getElementById('owner-listing-root')) return;
  const el = id => document.getElementById(id);
  if (global.self !== global.top) {
    for (const id of ['owner-access','owner-preview','owner-load','owner-sign','owner-confirm']) el(id).disabled = true;
    el('owner-state').textContent = 'Open this owner approval page directly, outside any embedded frame. Nothing has been signed.';
    return;
  }
  const session = createSession(global.crypto);
  let epoch = 0, review = null, busy = false;
  const downloads = new Set();
  const say = text => { el('owner-state').textContent = text; };
  function advertSummary(bodyText) {
    const fields = JSON.parse(bodyText).fields;
    const has = (value, name) => Object.prototype.hasOwnProperty.call(value, name);
    const literal = value => typeof value === 'string' ? value : canonical(value);
    const lines = [];
    for (const [name, label] of [['title','Title'],['category','Category'],['scope','Scope (public field)']]) {
      if (has(fields, name)) lines.push(label + ': ' + literal(fields[name]));
    }
    if (record(fields.custom)) {
      for (const [name, label] of [['description','Description'],['scope','Scope']]) {
        if (has(fields.custom, name)) lines.push(label + ': ' + literal(fields.custom[name]));
      }
    }
    for (const [name, label] of [['offer','Offered resources'],['want','Requested resources']]) {
      if (!has(fields, name)) continue;
      const legs = fields[name];
      const readable = Array.isArray(legs) && legs.length ? legs.map((leg, index) => {
        if (record(leg) && has(leg, 'amount') && record(leg.asset) && ['namespace','identifier','unit'].every(key => has(leg.asset, key))) {
          return (index + 1) + '. Amount: ' + literal(leg.amount) + '; resource: ' + literal(leg.asset.namespace) + ' / ' + literal(leg.asset.identifier) + '; unit: ' + literal(leg.asset.unit);
        }
        return (index + 1) + '. ' + literal(leg);
      }).join('\n') : literal(legs);
      lines.push(label + ':\n' + readable);
    }
    return lines.join('\n\n');
  }
  function reset() {
    epoch++; session.invalidate(); review = null;
    if (el('owner-summary')) el('owner-summary').textContent = '';
    el('owner-body').textContent = ''; el('owner-digest').textContent = '';
    el('owner-visibility').textContent = ''; el('owner-review').hidden = true;
    el('owner-confirm').checked = false; el('owner-sign').disabled = true;
    say('Files changed. Review both selected files again. Nothing has been signed.');
  }
  function refused(error) {
    const code = error instanceof Refused ? error.message : 'LOCAL_CHECK_FAILED';
    const help = {
      SELECT_BOTH_FILES: 'Choose both your private access file and the prepared advert file.',
      PUBLICATION_TARGET: 'This preview is for a different service or record type. Ask your agent for an advert preview from this Covenant account.',
      PUBLICATION_EXPIRED: 'This advert preview has expired. Ask your agent to prepare a fresh preview.',
      SIGNER_MISMATCH: 'These files belong to different signing identities. Choose the matching access file and advert preview.',
      INPUT_CHANGED: 'A selected file changed. Check the files and review the advert again.',
      APPROVAL_NOT_GIVEN: 'Review the advert and tick the approval box before signing.',
      ED25519_UNAVAILABLE: 'This browser cannot sign this format here. Use the standalone signer below.',
      INPUT_SIZE: 'One of these files is empty or too large. Keep the original and ask for a complete supported preview.'
    };
    const message = Object.prototype.hasOwnProperty.call(help, code) ? help[code] : 'The files could not be checked safely. Keep the originals and use the owner-signing guide below.';
    say(message + ' No publication or payment was attempted. Reference: ' + code + '.');
  }
  async function selected() {
    const accessFile = el('owner-access').files[0], previewFile = el('owner-preview').files[0];
    need(accessFile && previewFile, 'SELECT_BOTH_FILES');
    need(accessFile.size > 0 && accessFile.size <= 32768 && previewFile.size > 0 && previewFile.size <= 262144, 'INPUT_SIZE');
    return {accessRaw:new Uint8Array(await accessFile.arrayBuffer()), previewRaw:new Uint8Array(await previewFile.arrayBuffer())};
  }
  el('owner-access').addEventListener('change', reset);
  el('owner-preview').addEventListener('change', reset);
  el('owner-load').addEventListener('click', async () => {
    if (busy) return;
    reset(); const ticket = epoch; busy = true; el('owner-load').disabled = true;
    try {
      need(global.isSecureContext, 'ED25519_UNAVAILABLE');
      const inputs = await selected();
      need(ticket === epoch, 'INPUT_CHANGED');
      const current = await session.prepare(inputs.accessRaw, inputs.previewRaw);
      need(ticket === epoch, 'INPUT_CHANGED');
      review = current;
      if (el('owner-summary')) el('owner-summary').textContent = advertSummary(current.bodyText);
      el('owner-body').textContent = current.bodyText;
      el('owner-digest').textContent = current.bodyHash;
      el('owner-visibility').textContent = current.visibilityWarning;
      el('owner-review').hidden = false;
      say('Both files checked. Review every displayed field and metadata item, then choose whether to create this one advert approval.');
    } catch (error) { if (ticket === epoch) { session.invalidate(); refused(error); } }
    finally { busy = false; el('owner-load').disabled = false; }
  });
  el('owner-confirm').addEventListener('change', () => { el('owner-sign').disabled = busy || !review || !el('owner-confirm').checked; });
  el('owner-sign').addEventListener('click', async () => {
    if (busy || !review || !el('owner-confirm').checked) return;
    const ticket = epoch; busy = true; el('owner-sign').disabled = true; el('owner-load').disabled = true;
    try {
      const inputs = await selected();
      need(ticket === epoch, 'INPUT_CHANGED');
      const approval = await session.approve({...inputs, reviewed:el('owner-confirm').checked, displayedBody:el('owner-body').textContent});
      need(ticket === epoch, 'INPUT_CHANGED');
      const url = URL.createObjectURL(new Blob([canonical(approval) + '\n'], {type:'application/json'}));
      downloads.add(url);
      const link = document.createElement('a'); link.href = url; link.download = 'listing-approval.json';
      document.body.appendChild(link); link.click(); link.remove();
      global.setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(url); }, 1000);
      review = null; el('owner-confirm').checked = false;
      say('Approval download started. Check that listing-approval.json was saved. Return only that approval JSON to your agent with the unchanged prepared body and original source. Nothing was published or paid.');
    } catch (error) { if (ticket === epoch) { session.invalidate(); review = null; el('owner-confirm').checked = false; refused(error); } }
    finally { busy = false; el('owner-load').disabled = false; }
  });
  el('owner-clear').addEventListener('click', () => { reset(); el('owner-access').value = ''; el('owner-preview').value = ''; say('Selected files and approval review cleared. Nothing was published or paid.'); });
  global.addEventListener('pagehide', () => { session.invalidate(); review = null; for (const url of downloads) URL.revokeObjectURL(url); downloads.clear(); });
})(typeof globalThis === 'object' ? globalThis : this);
