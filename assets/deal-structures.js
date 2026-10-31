/* Versioned drafting recipes. A recipe or public-search handoff is not assent. */
'use strict';
(() => {
  const VERSION = 'urn:aap:deal-structure-template:0.1';
  const HANDOFF = 'urn:aap:public-advert-handoff:0.1';
  const PUBLISHER = 'https://jupie202020.pythonanywhere.com';
  const HASH_PROFILE = 'SHA256_AAP_DEAL_STRUCTURE_TEMPLATE_0_1_ASCII_SORTED_JSON';
  const TEMPLATE_DOMAIN = 'AAP-DEAL-STRUCTURE-TEMPLATE-0.1\0';
  const HANDOFF_DOMAIN = 'AAP-PUBLIC-ADVERT-HANDOFF-0.1\0';
  const TEMPLATES = [
    {version: VERSION, id: 'fixed-deliverable', revision: 1, title: 'One fixed deliverable', kind: 'FIXED_DELIVERABLE', status: 'UNSIGNED_DRAFTING_RECIPE', native_composition: 'One work undertaking and separately adopted consideration; native agreement setup is separate.', description: 'One scope, one exchange and an explicit review step.', details_label: 'Review and additional terms (optional)', requires_details: false, specialist: false, execution_authorized: false},
    {version: VERSION, id: 'staged-milestones', revision: 1, title: 'Stages and milestones', kind: 'STAGED_MILESTONES', status: 'UNSIGNED_DRAFTING_RECIPE', native_composition: 'Explicit staged leg composition in the installed system; this page drafts the stated stages only.', description: 'Break the work into named stages, with a review or deadline for each.', details_label: 'One milestone per line: work, deadline and acceptance check', requires_details: true, specialist: false, execution_authorized: false},
    {version: VERSION, id: 'reciprocal-exchange', revision: 1, title: 'Reciprocal exchange or barter', kind: 'RECIPROCAL_EXCHANGE', status: 'UNSIGNED_DRAFTING_RECIPE', native_composition: 'Reciprocal or barter undertakings; adopted settlement and external delivery are separate.', description: 'State what each side owes, including services, assets or resources.', details_label: 'Coordination and review terms (optional)', requires_details: false, specialist: false, execution_authorized: false},
    {version: VERSION, id: 'contingent-rights-draft', revision: 1, title: 'Contingent right or option (draft only)', kind: 'CONTINGENT_RIGHTS_DESCRIPTOR', status: 'DRAFTING_ONLY_NO_OPTIONS_LIFECYCLE', native_composition: 'Descriptor only. No exercise, assignment, expiry, valuation or settlement lifecycle is supplied.', description: 'Describe a possible right and its conditions for specialist review.', details_label: 'Holder, writer, right, trigger, exercise window and review terms', requires_details: true, specialist: true, execution_authorized: false}
  ];
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  function need(ok, code) {if (!ok) throw new Error(code);}
  function exact(value, required, optional = []) {
    need(object(value), 'Expected one object.');
    const keys = Object.keys(value);
    need(required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) && keys.every((key) => required.includes(key) || optional.includes(key)), 'Unexpected or missing handoff fields.');
  }
  function string(value, max, empty = false) {
    need(typeof value === 'string' && (empty || value.length > 0) && value.length <= max, 'A text field is missing or too long.');
    // Reject lone surrogates rather than let UTF-8 replacement collapse inputs.
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {need(i + 1 < value.length && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff, 'Invalid Unicode text.'); i++;}
      else need(code < 0xdc00 || code > 0xdfff, 'Invalid Unicode text.');
    }
    return value;
  }
  function canonical(value, depth = 0) {
    need(depth <= 16, 'The proposal is too deeply nested.');
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(string(value, 16000, true));
    if (typeof value === 'number') {need(Number.isSafeInteger(value), 'Use exact integer quantities.'); return JSON.stringify(value);}
    if (Array.isArray(value)) {need(value.length <= 64, 'Too many proposal items.'); return '[' + value.map((v) => canonical(v, depth + 1)).join(',') + ']';}
    need(object(value), 'Unsupported proposal value.');
    const keys = Object.keys(value).sort(); need(keys.length <= 64, 'Too many proposal fields.');
    return '{' + keys.map((key) => JSON.stringify(string(key, 128)) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
  }
  async function digest(domain, value) {
    need(typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle, 'A secure browser is required to pin the proposal.');
    const bytes = new TextEncoder().encode(domain + canonical(value));
    need(bytes.length <= 65536, 'The public proposal exceeds the handoff limit.');
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function template(id) {
    const found = TEMPLATES.find((value) => value.id === id);
    need(found, 'Choose a known deal structure.');
    return clone(found);
  }
  function catalogue() {return TEMPLATES.map(clone);}
  async function templatePin(id) {
    const snapshot = template(id);
    need([...canonical(snapshot)].every((character) => character.charCodeAt(0) <= 127), 'Template hashing is limited to the declared ASCII snapshot.');
    return {snapshot, hash: await digest(TEMPLATE_DOMAIN, snapshot), hash_profile: HASH_PROFILE};
  }
  function leg(value) {
    exact(value, ['asset', 'amount']); exact(value.asset, ['namespace', 'identifier', 'unit']);
    need(Number.isSafeInteger(value.amount) && value.amount >= 1, 'Invalid public offered or requested quantity.');
    ['namespace', 'identifier', 'unit'].forEach((key) => string(value.asset[key], 256));
    return clone(value);
  }
  function legs(values) {need(Array.isArray(values) && values.length <= 16, 'Invalid public exchange legs.'); return values.map(leg);}
  function selectedFields(fields) {
    need(object(fields), 'The public advert has no display fields.');
    const out = {title: string(fields.title, 256)};
    ['category', 'summary', 'description'].forEach((key) => {if (typeof fields[key] === 'string') out[key] = string(fields[key], key === 'category' ? 128 : 4000, true);});
    if (object(fields.custom)) ['description', 'scope'].forEach((key) => {if (typeof fields.custom[key] === 'string') out[key] = string(fields.custom[key], 4000, true);});
    ['offer', 'want'].forEach((key) => {
      if (Array.isArray(fields[key])) {
        need(fields[key].length <= 16, 'Too many public exchange legs.');
        // Only visible asset names/units and amounts. Do not read transfer
        // terms, private notes, adapters or undisclosed source data.
        out[key] = fields[key].map((value) => {
          need(object(value) && object(value.asset), 'Invalid public exchange leg.');
          return leg({amount: value.amount, asset: {namespace: value.asset.namespace, identifier: value.asset.identifier, unit: value.asset.unit}});
        });
      }
    });
    return out;
  }
  function validateAdvert(advert) {
    exact(advert, ['id', 'publisher', 'url', 'source_kind', 'provenance_verified', 'snapshot']);
    need(typeof advert.id === 'string' && /^[0-9a-f]{64}$/.test(advert.id), 'Invalid public advert identifier.');
    need(advert.publisher === PUBLISHER && advert.source_kind === 'PUBLIC_SEARCH_PROJECTION' && advert.provenance_verified === false, 'This handoff must remain an unverified search projection from the adopted publisher.');
    const expected = PUBLISHER + '/marketplace/' + advert.id;
    need(advert.url === expected || advert.url === expected + '.json', 'The advert link does not match its adopted publisher and identifier.');
    exact(advert.snapshot, ['title'], ['category', 'summary', 'description', 'scope', 'offer', 'want']);
    string(advert.snapshot.title, 256);
    ['category', 'summary', 'description', 'scope'].forEach((key) => {if (Object.prototype.hasOwnProperty.call(advert.snapshot, key)) string(advert.snapshot[key], key === 'category' ? 128 : 4000, true);});
    ['offer', 'want'].forEach((key) => {if (Object.prototype.hasOwnProperty.call(advert.snapshot, key)) legs(advert.snapshot[key]);});
    canonical(advert);
    return clone(advert);
  }
  function advertFromPublication(publication) {
    need(object(publication) && publication.visibility === 'INDEXED', 'Choose an actual searchable public advert.');
    const advert = {id: publication.id, publisher: PUBLISHER, url: publication.url,
      source_kind: 'PUBLIC_SEARCH_PROJECTION', provenance_verified: false,
      snapshot: selectedFields(publication.fields)};
    // Consent and source metadata, even if present on a search response, are
    // intentionally not promoted to a verified native source pin by this UI.
    return validateAdvert(advert);
  }
  async function makeHandoff(publication) {
    const body = {version: HANDOFF, advert: advertFromPublication(publication)};
    return {...body, handoff_hash: await digest(HANDOFF_DOMAIN, body)};
  }
  async function readHandoff(text) {
    string(text, 65536); need(new TextEncoder().encode(text).length <= 65536, 'The handoff file is too large.');
    let value; try {value = JSON.parse(text);} catch (_) {throw new Error('The handoff must be JSON.');}
    exact(value, ['version', 'advert', 'handoff_hash']);
    need(value.version === HANDOFF && typeof value.handoff_hash === 'string' && /^[0-9a-f]{64}$/.test(value.handoff_hash), 'Unsupported handoff format.');
    const advert = validateAdvert(value.advert);
    need(value.handoff_hash === await digest(HANDOFF_DOMAIN, {version: HANDOFF, advert}), 'The public handoff changed. Export it again rather than substituting a pin.');
    return advert;
  }
  function formatLegs(values) {
    if (!Array.isArray(values) || !values.length) return '';
    return values.map((value) => {
      const asset = value.asset;
      const minor = {USD: 'cents', GBP: 'pence', EUR: 'cents'};
      if (asset.namespace === 'fiat' && Object.prototype.hasOwnProperty.call(minor, asset.identifier) && minor[asset.identifier] === asset.unit) {
        const amount = BigInt(value.amount);
        return asset.identifier + ' ' + (amount / 100n) + '.' + (amount % 100n).toString().padStart(2, '0');
      }
      return value.amount + ' ' + asset.unit + ' of ' + asset.identifier + ' [' + asset.namespace + ']';
    }).join('; ');
  }
  function proposedFields(advert) {
    const checked = validateAdvert(advert), fields = checked.snapshot;
    return {title: fields.title.slice(0, 128), buyer: '', supplier: '',
      deliverable: [fields.description || fields.summary || fields.title, fields.scope || ''].filter(Boolean).join('\n').slice(0, 4000),
      price: formatLegs(fields.want) || 'Exact consideration remains to be agreed.'};
  }
  async function buildDraft(input) {
    exact(input, ['template_id', 'fields', 'details', 'selected_advert', 'specialist_acknowledged']);
    exact(input.fields, ['title', 'buyer', 'supplier', 'deliverable', 'price']);
    const values = input.fields;
    ['title', 'buyer', 'supplier', 'deliverable', 'price'].forEach((key) => string(values[key], key === 'deliverable' ? 4000 : key === 'price' ? 256 : 128));
    need(values.buyer !== values.supplier, 'Give the two parties distinct names or public identifiers.');
    string(input.details, 4000, true); need(typeof input.specialist_acknowledged === 'boolean', 'Confirm the chosen structure explicitly.');
    const pin = await templatePin(input.template_id), chosen = pin.snapshot;
    need(!chosen.requires_details || input.details.trim(), 'Add the stated stages or conditions for this structure.');
    need(!chosen.specialist || input.specialist_acknowledged === true, 'A contingent right is drafting-only; acknowledge that no options lifecycle is supplied.');
    const advert = input.selected_advert === null ? null : validateAdvert(input.selected_advert);
    const clauses = [{id: 'scope', title: 'Work or undertaking', text: values.deliverable},
      {id: 'exchange', title: chosen.kind === 'RECIPROCAL_EXCHANGE' ? 'Reciprocal undertaking' : 'Price or exchange', text: values.price}];
    const proposed = {scope: values.deliverable, consideration: values.price, additional_terms: input.details};
    if (chosen.kind === 'STAGED_MILESTONES') {
      const stages = input.details.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      need(stages.length >= 1 && stages.length <= 8, 'Use one to eight milestone lines in this simple form.');
      proposed.milestones = stages.map((line, index) => ({position: index + 1, text: string(line, 1000)}));
      proposed.milestones.forEach((stage) => clauses.push({id: 'milestone-' + stage.position, title: 'Milestone ' + stage.position, text: stage.text}));
    } else if (input.details) clauses.push({id: 'additional-terms', title: chosen.specialist ? 'Proposed contingent right and conditions' : 'Coordination and review terms', text: input.details});
    if (chosen.specialist) clauses.push({id: 'specialist-boundary', title: 'Drafting-only boundary', text: 'These clauses are a descriptor for review. This interface supplies no options exercise, assignment, expiry, valuation, custody or settlement lifecycle.'});
    clauses.push({id: 'approval', title: 'Approval and source verification', text: 'This is an unsigned buyer proposal. The parties must approve the exact terms separately. If this proposal refers to an advert, its public search projection is not the verified source offer; fetch and verify the exact source publication before signing. No payment or external execution is authorised by this draft.'});
    const extension = {version: VERSION, template_id: chosen.id, template_revision: chosen.revision,
      template_hash: pin.hash, template_hash_profile: pin.hash_profile, template_snapshot: chosen,
      role: 'BUYER_PROPOSED', selected_advert: advert, source_pin_status: advert === null ? 'NOT_APPLICABLE_NO_ADVERT' : 'MISSING_EXACT_VERIFIED_SOURCE',
      proposed_terms: proposed, execution_authorized: false};
    const request = {title: values.title, parties: [values.buyer, values.supplier], clauses,
      extensions: {aap_deal_structure: extension}};
    need(new TextEncoder().encode(canonical(request)).length <= 50000, 'This proposal is too large for the simple public form.');
    return {request, extension};
  }
  function responseRetains(request, record) {
    if (!object(request) || !object(record) || !object(record.draft)) return false;
    const expected = {version: 'covenant-contract-draft/0.1', title: request.title,
      parties: request.parties, clauses: request.clauses,
      conditions: request.conditions === undefined ? [] : request.conditions,
      settlement: request.settlement === undefined ? {} : request.settlement,
      dispute: request.dispute === undefined ? {} : request.dispute,
      extensions: request.extensions === undefined ? {} : request.extensions,
      supersedes: null};
    // Exact native-body values, including defaults and the complete key set.
    // This is not independent verification of the returned native digest.
    try {return canonical(record.draft) === canonical(expected);}
    catch (_) {return false;}
  }
  class SelectionSession {
    constructor() {this.revision = 0; this.advert = null; this.output = null;}
    invalidate() {this.revision++; this.output = null; return this.revision;}
    select(advert) {this.advert = advert === null ? null : validateAdvert(advert); return this.invalidate();}
    capture() {return this.revision;}
    accepts(revision) {return revision === this.revision;}
    retain(revision, value) {if (!this.accepts(revision)) return false; this.output = value; return true;}
  }
  const api = Object.freeze({VERSION, HASH_PROFILE, catalogue, template, templatePin, canonical,
    advertFromPublication, validateAdvert, makeHandoff, readHandoff, proposedFields,
    formatLegs, buildDraft, responseRetains, SelectionSession});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AAPDealStructures = api;
  if (typeof document !== 'undefined') {
    const target = document.getElementById('deal-structure-catalogue');
    if (target) catalogue().forEach((item) => {
      const section = document.createElement('section'); section.id = item.id;
      const heading = document.createElement('h2'); heading.textContent = item.title; section.appendChild(heading);
      [item.description, item.native_composition, 'Revision ' + item.revision + ' · ' + (item.specialist ? 'Drafting descriptor only; no options lifecycle.' : 'Unsigned drafting recipe; no automatic execution.')].forEach((value) => {const p = document.createElement('p'); p.textContent = value; section.appendChild(p);});
      const link = document.createElement('a'); link.href = 'MATRIX.html?structure=' + encodeURIComponent(item.id) + '#draft-work'; link.textContent = 'Use this drafting structure'; section.appendChild(link);
      const pin = document.createElement('p'); pin.textContent = 'Computing the exact template snapshot hash…'; section.appendChild(pin);
      templatePin(item.id).then((value) => {pin.textContent = 'Template SHA-256: ' + value.hash;}).catch(() => {pin.textContent = 'A secure browser is needed to compute this template hash.';});
      target.appendChild(section);
    });
  }
})();
