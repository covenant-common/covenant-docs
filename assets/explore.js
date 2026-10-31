/* Local capability discovery. No service calls, credentials, analytics or persistence. */
'use strict';
(function (root, factory) {
  const explorer = factory();
  if (typeof module === 'object' && module.exports) module.exports = explorer;
  if (root && root.document) explorer.mount(root.document);
})(typeof window === 'undefined' ? null : window, function () {
  const ALL = '';
  // Maintained public navigation copy, separate from the source taxonomy.
  // These aliases suggest interfaces to inspect; they grant no capability or authority.
  const navigationAliases = Object.freeze(Object.fromEntries(Object.entries({
    covenant_agreement: ['coordinate coordination coordinating work', 'collaborate collaboration collaborative project', 'research plan', 'shared plan'],
    covenant_draft: ['draft a shared plan', 'propose work', 'research brief'],
    covenant_org: ['group groups team teams community communities', 'organisation organization organisations organizations', 'coordinate coordination coordinating', 'collaborate collaboration', 'research group', 'work together'],
    covenant_roles: ['group groups team teams', 'role roles responsibility responsibilities', 'coordinate coordination coordinating', 'collaborate collaboration', 'research contributors'],
    covenant_forum_read: ['forum forums discussion discussions', 'group groups team teams community', 'collaborate collaboration', 'research discussion', 'read shared messages'],
    covenant_forum_write: ['forum forums discussion discussions', 'group groups team teams community', 'collaborate collaboration', 'research discussion', 'write shared messages'],
    covenant_vote: ['vote votes voting ballot ballots', 'group groups team teams decision decisions'],
    covenant_consensus_vote: ['vote votes voting ballot ballots', 'group groups consensus decision decisions'],
    covenant_panel_vote: ['vote votes voting ballot ballots', 'review panel decision decisions'],
    covenant_decision: ['group decision decisions', 'choose compare alternatives'],
    covenant_invite: ['invite invitation invitations', 'join group groups team teams', 'collaborate collaboration'],
    covenant_obligations: ['coordinate coordination coordinating work', 'handoff handoffs', 'responsibility responsibilities', 'remaining unfinished work tasks progress'],
    covenant_continue: ['coordinate coordination coordinating work', 'handoff handoffs', 'resume continue next step unfinished work'],
    covenant_deliver: ['handoff handoffs', 'deliver delivery output results'],
    covenant_delivery: ['handoff handoffs', 'deliver delivery output results'],
    covenant_review: ['coordinate coordination review', 'handoff handoffs', 'research review', 'remaining unfinished work'],
    covenant_evidence: ['research evidence', 'delivery evidence', 'inspect supporting records'],
    covenant_evidence_export: ['handoff handoffs', 'export share evidence records'],
    covenant_evidence_import: ['handoff handoffs', 'import receive evidence records'],
    covenant_portable_agreement: ['handoff handoffs', 'portable agreement sharing'],
    covenant_procedures: ['method methods shared reusable methods', 'practice practices procedure procedures', 'research process'],
    covenant_publish_procedure: ['method methods shared reusable methods', 'share publish a procedure practice'],
    covenant_recall: ['method methods shared reusable methods', 'recall reuse saved records'],
    covenant_economics: ['economic economics research', 'economic model models'],
    preview_cooperation: ['coordinate coordination coordinating preview', 'collaborate collaboration preview', 'shared work plan'],
    covenant_auction: ['auction auctions bidding bids bid'],
    covenant_escrow: ['payment payments pay funds', 'escrow custody terms'],
    covenant_settle: ['payment payments pay settlement settle'],
    covenant_settlement: ['payment payments pay settlement settle'],
    covenant_stripe: ['payment payments pay stripe gateway'],
    covenant_commerce: ['payment payments commerce checkout'],
    covenant_exchange: ['payment payments exchange barter reciprocal trade'],
    covenant_atr_rail: ['payment payments rail rails transfer'],
    covenant_offline_trade: ['offline payment payments trade'],
    covenant_principal: ['delegation delegate delegated owner principal'],
    covenant_representation: ['delegation delegate delegated represent representation'],
    covenant_credential: ['credential credentials qualification qualifications'],
    covenant_identity: ['identity identities identify'],
    covenant_privacy: ['private privacy confidential disclosure'],
    covenant_proof: ['proof proofs prove verification'],
    covenant_prove: ['proof proofs prove verification'],
    covenant_ads: ['advertising advertisement advertisements advert adverts ads'],
    covenant_advertise: ['advertising advertisement advertisements advert adverts publish service'],
    covenant_ad_report: ['advertising advertisement advertisements report'],
    covenant_pick_sponsor: ['advertising sponsor sponsors sponsorship'],
    covenant_marketplace: ['market markets marketplace services offers'],
    covenant_marketplace_read: ['market markets marketplace services offers search'],
    covenant_marketplace_publish: ['market markets marketplace services offers publish'],
    covenant_hire: ['hire hiring supplier suppliers services'],
    covenant_arbitration: ['dispute disputes arbitration remedy remedies'],
    covenant_dispute_forum: ['dispute disputes discussion discussions forum'],
    covenant_connector: ['connect integration integrations adapter adapters'],
    covenant_interoperate: ['connect integration integrations interoperability'],
    covenant_robotics: ['robot robots robotics device devices']
  }).map(([name, aliases]) => [name, Object.freeze(aliases)])));
  const filler = new Set(['a', 'an', 'the', 'i', 'me', 'my', 'we', 'our', 'us', 'to', 'for', 'with', 'and', 'of', 'in', 'on', 'it', 'is', 'are', 'can', 'could', 'would', 'like', 'want', 'need', 'please', 'help', 'how', 'do', 'does', 'find', 'looking']);
  function tokens(value) {
    return String(value).normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}_]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  }
  function familyLabel(name) {
    return String(name).replace(/^covenant_/, '').replace(/__/g, ' / ').replace(/_/g, ' ');
  }
  function filterCatalog(catalog, filters) {
    const selected = filters || {};
    const rawQuery = String(selected.query || '').normalize('NFKC').toLocaleLowerCase('en').trim();
    const words = tokens(rawQuery).filter((word) => !filler.has(word));
    const exactFamily = Object.keys(catalog.tools).find((name) => name.toLocaleLowerCase('en') === rawQuery);
    const levels = new Map(catalog.levels.map((level) => [level.id, level]));
    return Object.entries(catalog.tools).flatMap(([name, tool]) => {
      if (exactFamily && name !== exactFamily) return [];
      if (selected.level && tool.level !== selected.level) return [];
      if (selected.maturity && tool.maturity !== selected.maturity) return [];
      if (selected.core === 'core' && !tool.core) return [];
      if (selected.core === 'extension' && tool.core) return [];
      if (selected.species === 'unassigned' && tool.species !== null) return [];
      if (selected.species && selected.species !== 'unassigned' && tool.species !== selected.species) return [];
      const level = levels.get(tool.level);
      const aliases = navigationAliases[name] || [];
      const familyWords = new Set(tokens(name + ' ' + familyLabel(name)));
      const aliasWords = new Set(aliases.flatMap(tokens));
      // Exact layer terms remain searchable. A layer's broad scope/question is
      // not a description of every family and must not contaminate its matches.
      const taxonomyWords = new Set(tokens([tool.level, tool.maturity,
        tool.core ? 'core interface' : 'extended interface',
        level.name, level.cause, tool.species || 'unassigned'].join(' ')));
      if (!exactFamily && !words.every((word) => familyWords.has(word) || aliasWords.has(word) || taxonomyWords.has(word))) return [];
      let matchReason = '';
      if (exactFamily) matchReason = 'Exact family identifier.';
      else if (words.length && words.every((word) => familyWords.has(word))) matchReason = 'Matches the family name.';
      else if (words.some((word) => aliasWords.has(word) && !familyWords.has(word) && !taxonomyWords.has(word))) {
        const matched = words.filter((word) => aliasWords.has(word) && !familyWords.has(word) && !taxonomyWords.has(word));
        matchReason = 'Navigation alias: ' + Array.from(new Set(matched)).join(', ') + '.';
      } else if (words.length) matchReason = 'Matches the taxonomy or readiness label.';
      return [{name, ...tool, matchReason}];
    }).sort((toolA, toolB) => {
      return catalog.order.indexOf(toolA.level) - catalog.order.indexOf(toolB.level) || toolA.name.localeCompare(toolB.name, 'en');
    });
  }
  function appendText(doc, parent, tag, text, className) {
    const element = doc.createElement(tag);
    element.textContent = String(text);
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }
  function renderResults(container, catalog, filters, doc) {
    const matches = filterCatalog(catalog, filters);
    container.replaceChildren();
    if (!matches.length) {
      appendText(doc, container, 'p', 'No tool families match these filters. Clear a filter or try a shorter phrase.');
      return matches;
    }
    catalog.order.forEach((id) => {
      const group = matches.filter((tool) => tool.level === id);
      if (!group.length) return;
      const level = catalog.levels.find((item) => item.id === id);
      const section = doc.createElement('section');
      section.className = 'explore-result-group';
      appendText(doc, section, 'h3', level.question + ' — ' + group.length + ' families');
      const list = doc.createElement('ul');
      list.className = 'explore-families';
      group.forEach((tool) => {
        const item = doc.createElement('li');
        const label = familyLabel(tool.name);
        appendText(doc, item, 'strong', label.charAt(0).toUpperCase() + label.slice(1));
        appendText(doc, item, 'span', tool.maturity + ' · ' + (tool.core ? 'core interface' : 'extended interface'), 'explore-readiness');
        if (tool.matchReason) appendText(doc, item, 'p', tool.matchReason, 'explore-match');
        const details = doc.createElement('details');
        appendText(doc, details, 'summary', 'Exact tool family and placement');
        appendText(doc, details, 'code', tool.name);
        appendText(doc, details, 'p', level.id + ' · ' + level.name + ' · ' + level.cause + ' cause');
        if (tool.species) {
          const kind = catalog.species.find((entry) => entry.id === tool.species);
          appendText(doc, details, 'p', 'Agreement species: ' + kind.id + ' — ' + kind.differentia);
        } else appendText(doc, details, 'p', 'No agreement species is assigned to this family in this profile.');
        item.appendChild(details);
        list.appendChild(item);
      });
      section.appendChild(list);
      container.appendChild(section);
    });
    return matches;
  }
  function mount(doc) {
    const data = doc.getElementById('capability-catalog');
    const controls = doc.getElementById('explore-controls');
    if (!data || !controls) return;
    let catalog;
    try { catalog = JSON.parse(data.textContent); } catch (_) { return; }
    const query = doc.getElementById('explore-query');
    const level = doc.getElementById('explore-level');
    const maturity = doc.getElementById('explore-maturity');
    const core = doc.getElementById('explore-core');
    const species = doc.getElementById('explore-species');
    const results = doc.getElementById('explore-results');
    const status = doc.getElementById('explore-count');
    const selects = [level, maturity, core, species];
    function update() {
      const filters = {query: query.value, level: level.value, maturity: maturity.value, core: core.value, species: species.value};
      const matches = renderResults(results, catalog, filters, doc);
      const counts = new Map(catalog.order.map((id) => [id, matches.filter((tool) => tool.level === id).length]));
      status.textContent = 'Showing ' + matches.length + ' of ' + Object.keys(catalog.tools).length + ' installed tool families.';
      doc.querySelectorAll('[data-layer-count]').forEach((item) => { item.textContent = String(counts.get(item.dataset.layerCount)); });
      return matches;
    }
    query.addEventListener('input', update);
    selects.forEach((select) => select.addEventListener('change', update));
    controls.addEventListener('submit', (event) => event.preventDefault());
    doc.getElementById('explore-clear').addEventListener('click', () => {
      query.value = ALL;
      selects.forEach((select) => { select.value = ALL; });
      update();
      query.focus();
    });
    doc.querySelectorAll('[data-explore-layer]').forEach((button) => {
      button.hidden = false;
      button.addEventListener('click', () => {
        level.value = button.dataset.exploreLayer;
        update();
        controls.scrollIntoView({block: 'start'});
        query.focus();
      });
    });
    update();
    controls.hidden = false;
    doc.getElementById('explore-live').hidden = false;
  }
  return Object.freeze({familyLabel, filterCatalog, renderResults, mount, navigationAliases});
});
