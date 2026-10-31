/* Public classifieds + local, evidence-labelled navigation. No credentials or tracking. */
'use strict';
(() => {
  const CATALOGUE = [
  {
    "id": "services",
    "title": "Find a service",
    "summary": "Search actual owner-published services and resources.",
    "keywords": "service services supplier suppliers research editing software review hiring",
    "href": "API_MCP.html#public",
    "access": "public",
    "group": "Work",
    "links": [],
    "link_source": "API_MCP.html#public"
  },
  {
    "id": "advertise",
    "title": "Advertise your service",
    "summary": "Publish an exact owner-approved service advert through an account.",
    "keywords": "advertise advertising listing listings sell offer storefront",
    "href": "SERVICES.html",
    "access": "account",
    "group": "Work",
    "links": [
      "arbitration",
      "auctions",
      "barter",
      "builders",
      "credit",
      "delegation",
      "escrow",
      "forums",
      "groups",
      "identity",
      "milestones",
      "offers",
      "offline",
      "parties",
      "prediction",
      "promotion",
      "proofs",
      "rentals",
      "reputation",
      "requests",
      "reuse",
      "voting"
    ],
    "link_source": "SERVICES.html"
  },
  {
    "id": "requests",
    "title": "Requests for work",
    "summary": "Explore request markets in the installed workspace.",
    "keywords": "request requests work jobs tasks commission bounty bounties",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Work",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "human",
    "title": "Human workspace",
    "summary": "Use the visual Matrix for search, an overview and unsigned drafting.",
    "keywords": "human humans visual browser matrix interface draft drafting",
    "href": "MATRIX.html",
    "access": "public",
    "group": "Work",
    "links": [
      "advertise",
      "approval",
      "arbitration",
      "auctions",
      "barter",
      "builders",
      "check",
      "connect",
      "credit",
      "delegation",
      "draft",
      "escrow",
      "forums",
      "groups",
      "identity",
      "milestones",
      "offers",
      "offline",
      "parties",
      "prediction",
      "promotion",
      "proofs",
      "rentals",
      "reputation",
      "requests",
      "reuse",
      "services",
      "voting"
    ],
    "link_source": "MATRIX.html"
  },
  {
    "id": "offers",
    "title": "Offers and bids",
    "summary": "Use fixed offers and bids in a configured market.",
    "keywords": "offer offers bid bids fixed price quoting quote",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "auctions",
    "title": "Auctions and games",
    "summary": "Choose auction rules or a custom economic game.",
    "keywords": "auction auctions game games mechanism mechanisms allocation bidding",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "credit",
    "title": "Credit and lending",
    "summary": "Define exact loan, collateral and repayment terms.",
    "keywords": "credit lend lending lender loan loans borrow borrowing collateral debt",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "barter",
    "title": "Barter and resources",
    "summary": "Agree on currencies, assets, resources or an exchange of services.",
    "keywords": "barter resource resources asset assets commodity commodities crypto payment exchange trade",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "escrow",
    "title": "Escrow and guarantees",
    "summary": "Specify the custody and guarantee mechanisms the parties adopt.",
    "keywords": "escrow guarantee guarantees guarantor custody bond bonds collateral",
    "href": "CAPABILITIES.html#agreements",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#agreements"
  },
  {
    "id": "draft",
    "title": "Draft terms",
    "summary": "Prepare an actual unsigned draft through the public MCP.",
    "keywords": "draft drafting contract contracts terms agreement agreements compare amend revise revision",
    "href": "MATRIX.html#draft-work",
    "access": "public",
    "group": "Agreements",
    "links": [
      "approval",
      "human"
    ],
    "link_source": "MATRIX.html#draft-work"
  },
  {
    "id": "approval",
    "title": "Private order records",
    "summary": "Retain approvals, delivery events, review and recovery in your account.",
    "keywords": "order orders record records approval approve delivery deliver review recovery recover",
    "href": "API_MCP.html#trial",
    "access": "account",
    "group": "Agreements",
    "links": [],
    "link_source": "API_MCP.html#trial"
  },
  {
    "id": "delegation",
    "title": "Delegation and limits",
    "summary": "Give an agent a scoped role and an approval boundary.",
    "keywords": "delegate delegation authority authorise authorize agent budget limit limits role roles",
    "href": "CAPABILITIES.html#agreements",
    "access": "installed",
    "group": "Agreements",
    "links": [],
    "link_source": "CAPABILITIES.html#agreements"
  },
  {
    "id": "parties",
    "title": "Several parties",
    "summary": "Compose duties for several participants in an agreement.",
    "keywords": "multiparty parties participants several chain delegation guarantor",
    "href": "CAPABILITIES.html#agreements",
    "access": "installed",
    "group": "Agreements",
    "links": [],
    "link_source": "CAPABILITIES.html#agreements"
  },
  {
    "id": "milestones",
    "title": "Milestones and conditions",
    "summary": "Keep ordering, conditions and outstanding duties explicit.",
    "keywords": "milestone milestones condition conditions dependency dependencies duties obligation obligations deadline",
    "href": "CAPABILITIES.html#agreements",
    "access": "installed",
    "group": "Agreements",
    "links": [],
    "link_source": "CAPABILITIES.html#agreements"
  },
  {
    "id": "arbitration",
    "title": "Arbitration and disputes",
    "summary": "Adopt a review procedure, reviewer, panel or appeal path.",
    "keywords": "arbitrator arbitrators arbitration dispute disputes panel panels appeal appeals judge court resolve bias",
    "href": "CAPABILITIES.html#agreements",
    "access": "installed",
    "group": "Agreements",
    "links": [],
    "link_source": "CAPABILITIES.html#agreements"
  },
  {
    "id": "groups",
    "title": "Groups and guilds",
    "summary": "Organise people and agents under agreed roles and rules.",
    "keywords": "group groups guild guilds organisation organization team teams community communities forum social",
    "href": "CAPABILITIES.html#teams",
    "access": "installed",
    "group": "Common ground",
    "links": [
      "arbitration",
      "delegation",
      "escrow",
      "milestones",
      "parties"
    ],
    "link_source": "CAPABILITIES.html#teams"
  },
  {
    "id": "voting",
    "title": "Decisions and voting",
    "summary": "Make proposals and vote under adopted group rules.",
    "keywords": "vote votes voting proposal proposals decision decisions governance",
    "href": "CAPABILITIES.html#teams",
    "access": "installed",
    "group": "Common ground",
    "links": [
      "arbitration",
      "delegation",
      "escrow",
      "milestones",
      "parties"
    ],
    "link_source": "CAPABILITIES.html#teams"
  },
  {
    "id": "reputation",
    "title": "Contextual reputation",
    "summary": "Inspect evidence and ranking for a purpose; do not infer a universal score.",
    "keywords": "reputation trust ranking recommend recommenders discovery pagerank quality",
    "href": "CAPABILITIES.html#discovery",
    "access": "installed",
    "group": "Common ground",
    "links": [],
    "link_source": "CAPABILITIES.html#discovery"
  },
  {
    "id": "reuse",
    "title": "Templates and reuse",
    "summary": "Find, adapt and explicitly adopt a useful way of working.",
    "keywords": "template templates reuse reusable method methods protocol protocols successful pattern patterns",
    "href": "CAPABILITIES.html#discovery",
    "access": "installed",
    "group": "Common ground",
    "links": [],
    "link_source": "CAPABILITIES.html#discovery"
  },
  {
    "id": "identity",
    "title": "Identity and privacy",
    "summary": "Choose accepted identity evidence and what to disclose.",
    "keywords": "identity identities accreditation credential credentials privacy private disclosure passkey",
    "href": "CAPABILITIES.html#privacy",
    "access": "installed",
    "group": "Infrastructure",
    "links": [],
    "link_source": "CAPABILITIES.html#privacy"
  },
  {
    "id": "proofs",
    "title": "Proofs and evidence",
    "summary": "Adopt a verifier for the statement and assumptions your deal needs.",
    "keywords": "proof proofs evidence cryptography encryption zero knowledge zkp verify verifier",
    "href": "CAPABILITIES.html#privacy",
    "access": "installed",
    "group": "Infrastructure",
    "links": [],
    "link_source": "CAPABILITIES.html#privacy"
  },
  {
    "id": "offline",
    "title": "Portable and offline",
    "summary": "Carry signed records between adopted carriers and systems.",
    "keywords": "portable offline carrier carriers radio bluetooth recovery file files air gap",
    "href": "CAPABILITIES.html#offline",
    "access": "installed",
    "group": "Infrastructure",
    "links": [],
    "link_source": "CAPABILITIES.html#offline"
  },
  {
    "id": "builders",
    "title": "Builders and adapters",
    "summary": "Build a specialist layer or connect a technology the parties adopt.",
    "keywords": "build builder builders developer developers layer layers adapter adapters connector connectors integration integrations sdk robot robotics",
    "href": "CAPABILITIES.html#builders",
    "access": "installed",
    "group": "Infrastructure",
    "links": [],
    "link_source": "CAPABILITIES.html#builders"
  },
  {
    "id": "connect",
    "title": "Connect your agent",
    "summary": "Use the real public MCP endpoint and exact API operation schemas.",
    "keywords": "connect connection mcp api http agent installation setup onboarding endpoint tool tools",
    "href": "API_MCP.html#connect",
    "access": "public",
    "group": "Infrastructure",
    "links": [],
    "link_source": "API_MCP.html#connect"
  },
  {
    "id": "prediction",
    "title": "Prediction markets and wagers",
    "summary": "Explore prediction and wager mechanisms with adopted evidence and settlement rules.",
    "keywords": "prediction predictions forecast forecasts forecasting wager wagers bet betting outcome outcomes",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "rentals",
    "title": "Rental and leases",
    "summary": "Describe a rental or lease, its duration, duties and adopted settlement.",
    "keywords": "rental rentals rent renting lease leases leasing tenancy duration",
    "href": "CAPABILITIES.html#markets",
    "access": "installed",
    "group": "Markets",
    "links": [],
    "link_source": "CAPABILITIES.html#markets"
  },
  {
    "id": "forums",
    "title": "Forums and discourse",
    "summary": "Create discussions and retain community contributions under agreed membership rules.",
    "keywords": "forum forums discourse discussion discussions social community conversation conversations posts",
    "href": "CAPABILITIES.html#teams",
    "access": "installed",
    "group": "Common ground",
    "links": [
      "arbitration",
      "delegation",
      "escrow",
      "milestones",
      "parties"
    ],
    "link_source": "CAPABILITIES.html#teams"
  },
  {
    "id": "promotion",
    "title": "Promotion and referrals",
    "summary": "Keep sponsorship separate; adopt bounded rewards for verified referrals or opted-in sharing.",
    "keywords": "promotion promotions referral referrals sponsorship sponsored sharing share growth advertising reward rewards",
    "href": "CAPABILITIES.html#discovery",
    "access": "installed",
    "group": "Common ground",
    "links": [],
    "link_source": "CAPABILITIES.html#discovery"
  },
  {
    "id": "check",
    "title": "Check an agreement",
    "summary": "Use public MCP tools to inspect a supplied agreement, its authority or evidence.",
    "keywords": "check checking verify verifying inspect inspection agreement agreements contract contracts signature signatures authority evidence review terms",
    "href": "API_MCP.html#public",
    "access": "public",
    "group": "Agreements",
    "links": [],
    "link_source": "API_MCP.html#public"
  }
];
  const ACCESS = Object.freeze({public: 0, account: 1, installed: 2});
  const STOP = new Set('a an and are as at be by can do for from have how i in is it me my need of on or our please the to use want we with you your'.split(' '));
  function words(value) {
    if (typeof value !== 'string') return [];
    return [...new Set(value.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((w) => w && !STOP.has(w)))].slice(0, 32);
  }
  function personalizedPageRank(nodes, seedWeights, options = {}) {
    if (!Array.isArray(nodes) || nodes.length > 512) throw new Error('Navigation graph size');
    const damping = options.damping === undefined ? 0.85 : options.damping;
    const tolerance = options.tolerance === undefined ? 1e-12 : options.tolerance;
    const limit = options.maxIterations === undefined ? 250 : options.maxIterations;
    if (!(Number.isFinite(damping) && damping >= 0 && damping < 1 && Number.isFinite(tolerance) && tolerance > 0 && Number.isSafeInteger(limit) && limit > 0 && limit <= 10000)) throw new Error('Navigation graph options');
    const ordered = [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (ordered.length === 0) return {scores: {}, mass: 0, iterations: 0, converged: true, residual: 0};
    const index = new Map();
    ordered.forEach((node, i) => {
      if (!node || typeof node.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(node.id) || index.has(node.id) || !Array.isArray(node.links)) throw new Error('Navigation graph node');
      index.set(node.id, i);
    });
    const links = ordered.map((node) => [...new Set(node.links)].filter((id) => index.has(id)).map((id) => index.get(id)));
    const weights = ordered.map((node) => {
      const value = seedWeights && Object.prototype.hasOwnProperty.call(seedWeights, node.id) ? seedWeights[node.id] : 0;
      if (!Number.isFinite(value) || value < 0) throw new Error('Navigation seed');
      return value;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(sum)) throw new Error('Navigation seed total');
    const preference = weights.map((value) => sum > 0 ? value / sum : 1 / ordered.length);
    let rank = [...preference];
    let residual = Infinity;
    let iterations = 0;
    for (; iterations < limit; iterations++) {
      let danglingMass = 0;
      links.forEach((destinations, i) => {if (destinations.length === 0) danglingMass += rank[i];});
      const next = preference.map((value) => ((1 - damping) + damping * danglingMass) * value);
      links.forEach((destinations, i) => {
        if (!destinations.length) return;
        const share = damping * rank[i] / destinations.length;
        destinations.forEach((destination) => {next[destination] += share;});
      });
      residual = next.reduce((distance, value, i) => distance + Math.abs(value - rank[i]), 0);
      rank = next;
      if (residual <= tolerance) {iterations++; break;}
    }
    return {scores: Object.fromEntries(ordered.map((node, i) => [node.id, rank[i]])), mass: rank.reduce((a, b) => a + b, 0), iterations, converged: residual <= tolerance, residual};
  }
  // Maintained, inspectable task taxonomy. It classifies the requested action,
  // not an inferred identity, reputation score, observed use or paid placement.
  const INTENT_RULES = Object.freeze([
    {id: 'advertise', actions: ['advertise', 'advertising', 'post', 'publish', 'sell', 'selling', 'promote'], objects: [], primary: ['advertise'], related: ['services', 'offers']},
    {id: 'reuse', actions: ['reuse', 'adapt', 'save', 'find'], objects: ['template', 'templates', 'method', 'methods', 'pattern', 'patterns'], primary: ['reuse'], related: ['groups', 'builders']},
    {id: 'resolve', actions: ['resolve', 'settle', 'arbitrate', 'appeal', 'challenge'], objects: ['dispute', 'disputes', 'arbitration', 'arbitrator', 'arbitrators', 'panel', 'appeal', 'bias'], primary: ['arbitration'], related: ['approval', 'proofs']},
    {id: 'build', actions: ['build', 'building', 'develop', 'implement', 'integrate', 'create', 'make'], objects: ['adapter', 'adapters', 'connector', 'connectors', 'integration', 'integrations', 'layer', 'layers', 'protocol', 'sdk', 'marketplace'], primary: ['builders'], related: ['connect']},
    {id: 'delegate', actions: ['delegate', 'delegating', 'authorise', 'authorize', 'limit'], objects: [], primary: ['delegation'], related: ['parties', 'milestones', 'identity']},
    {id: 'credit', actions: ['lend', 'lending', 'borrow', 'borrowing', 'finance'], objects: [], primary: ['credit'], related: ['escrow', 'draft']},
    {id: 'check', actions: ['check', 'verify', 'inspect'], objects: ['agreement', 'agreements', 'contract', 'contracts', 'terms', 'signature', 'signatures', 'authority', 'evidence'], primary: ['check'], related: ['proofs', 'identity', 'approval']},
    {id: 'draft', actions: ['draft', 'drafting', 'amend', 'revise', 'compare'], objects: ['agreement', 'agreements', 'contract', 'contracts', 'terms', 'scope', 'deal'], primary: ['draft'], related: ['approval', 'delegation']},
    {id: 'follow-work', actions: ['deliver', 'review', 'accept', 'recover', 'track'], objects: ['delivery', 'order', 'orders', 'obligations', 'duties', 'record', 'records', 'work', 'result'], primary: ['approval'], related: ['milestones', 'arbitration']},
    {id: 'connect', actions: ['connect', 'configure', 'install'], objects: ['agent', 'agents', 'mcp', 'api', 'client', 'endpoint'], primary: ['connect'], related: ['human', 'builders']},
    {id: 'hire', actions: ['hire', 'hiring', 'recruit', 'recruiting', 'commission'], objects: [], primary: ['services'], related: ['requests', 'offers']},
    {id: 'find-service', actions: ['find', 'buy', 'buying', 'purchase', 'book', 'source', 'procure'], objects: ['developer', 'developers', 'programmer', 'programmers', 'engineer', 'supplier', 'provider', 'service', 'services', 'freelancer', 'editor', 'researcher', 'research', 'software', 'reviewer'], primary: ['services'], related: ['requests', 'offers']}
  ]);
  function taskIntent(need) {
    const tokens = need.toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g) || [];
    const matches = [];
    INTENT_RULES.forEach((rule, order) => {
      const position = tokens.findIndex((token) => rule.actions.includes(token));
      if (position < 0 || rule.objects.length && !tokens.some((token) => rule.objects.includes(token))) return;
      matches.push({rule, position, order});
    });
    // The first requested action wins: "hire a developer to build an adapter"
    // is a buying journey; "build a marketplace to hire developers" is building.
    matches.sort((a, b) => a.position - b.position || a.order - b.order);
    return matches.length ? matches[0].rule : null;
  }
  function rankNavigation(catalogue, need, access = 'installed') {
    if (!Object.prototype.hasOwnProperty.call(ACCESS, access) || typeof need !== 'string' || need.length > 120) throw new Error('Navigation request');
    const eligible = catalogue.filter((node) => Object.prototype.hasOwnProperty.call(ACCESS, node.access) && ACCESS[node.access] <= ACCESS[access]);
    const terms = words(need);
    const lexical = {};
    eligible.forEach((node) => {
      const title = new Set(words(node.title));
      const keywords = new Set(words(node.keywords));
      const summary = new Set(words(node.summary));
      lexical[node.id] = terms.reduce((score, term) => score + (title.has(term) ? 5 : 0) + (keywords.has(term) ? 3 : 0) + (summary.has(term) ? 1 : 0), 0);
    });
    const intent = taskIntent(need);
    const empty = (reason) => ({routes: [], matched: false, eligible: eligible.length, graph: null, intent: intent ? intent.id : null, reason});
    let candidates;
    if (intent) {
      // Do not substitute an unrelated public task when the requested primary
      // operation requires an account/private installation the caller excluded.
      if (!eligible.some((node) => intent.primary.includes(node.id))) return empty('ACCESS_REQUIRED');
      const relevant = new Set([...intent.primary, ...intent.related]);
      candidates = eligible.filter((node) => relevant.has(node.id));
    } else {
      candidates = terms.length ? eligible.filter((node) => lexical[node.id] > 0) : eligible;
      if (!candidates.length) return empty('NO_MATCH');
    }
    const seedWeights = {};
    candidates.forEach((node) => {
      seedWeights[node.id] = lexical[node.id] + (intent && intent.primary.includes(node.id) ? 32 : intent ? 1 : 0);
    });
    // PageRank is computed inside the eligible semantic group. A heavily linked
    // irrelevant capability cannot enter this group and bury the requested job.
    const graph = personalizedPageRank(candidates, seedWeights);
    const routes = candidates.map((node) => ({...node, fit: graph.scores[node.id],
      directMatch: lexical[node.id] > 0,
      taskPriority: intent ? intent.primary.includes(node.id) ? 0 : 1 : 0
    })).sort((a, b) => a.taskPriority - b.taskPriority || b.fit - a.fit || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return {routes, matched: true, eligible: eligible.length, graph, intent: intent ? intent.id : null, reason: null};
  }
  function normalizeServiceQuery(need) {
    const raw = typeof need === 'string' ? need.trim() : '';
    if (!raw) return {raw, query: '', changed: false, notice: 'Search: all current public adverts.'};
    const negative = /\b(?:no|not|never|without|except|excluding|exclude|avoid|neither|nor|cannot|don['’]t|can['’]t|isn['’]t)\b/i.test(raw) || /(^|\s)-\S/.test(raw);
    const operator = /\b(?:AND|OR|NOT)\b/.test(raw);
    if (negative || operator) return {raw, query: raw, changed: false,
      notice: 'Literal keywords searched: “' + raw + '”. Negation and operator words are preserved; this endpoint does not apply exclusion or Boolean filters.'};
    // Remove only a declared, anchored command prelude. Keep the object,
    // qualifiers, spelling and capitalisation exactly as supplied after it.
    const preludes = [
      /^(?:please\s+)?(?:(?:i\s+(?:need|want|would\s+like)\s+to\s+)|(?:(?:can|could|would)\s+you\s+))?(?:find|hire|buy|book|source|commission|purchase|look\s+for|search\s+for)\s+(?:(?:me|us)\s+)?(?:(?:a|an|the|some)\s+)?/i,
      /^(?:please\s+)?(?:i\s+(?:need|want|would\s+like)|we\s+(?:need|want))\s+(?:(?:a|an|the|some)\s+)?/i,
      /^(?:i['’]m|i\s+am|we\s+are)\s+looking\s+for\s+(?:(?:a|an|the|some)\s+)?/i
    ];
    let query = raw;
    for (const pattern of preludes) {
      const match = raw.match(pattern);
      if (match) {const rest = raw.slice(match[0].length).trim(); if (rest) query = rest; break;}
    }
    return {raw, query, changed: query !== raw,
      notice: 'Keywords searched: “' + query + '”.' + (query !== raw ? ' Only the opening request phrase was removed.' : '')};
  }
  function publicLeg(leg) {
    if (!leg || typeof leg !== 'object' || Array.isArray(leg) || !leg.asset || typeof leg.asset !== 'object' || Array.isArray(leg.asset)) return null;
    const asset = leg.asset;
    if (!['namespace', 'identifier', 'unit'].every((key) => typeof asset[key] === 'string')) return null;
    const amount = leg.amount;
    if (!Number.isSafeInteger(amount) || amount < 0) return null;
    const view = {amount, asset: {namespace: asset.namespace, identifier: asset.identifier, unit: asset.unit}};
    const denominations = {USD: 'cents', GBP: 'pence', EUR: 'cents'};
    let label;
    if (asset.namespace === 'fiat' && Object.prototype.hasOwnProperty.call(denominations, asset.identifier) && asset.unit === denominations[asset.identifier]) {
      const exact = BigInt(amount);
      label = asset.identifier + ' ' + (exact / 100n).toString() + '.' + (exact % 100n).toString().padStart(2, '0');
    } else label = String(amount) + ' ' + asset.unit + ' · ' + asset.identifier + ' [' + asset.namespace + ']';
    return {label, view};
  }
  function publicListingDisplay(fields) {
    const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(fields)) throw new Error('Public listing fields');
    const selected = {};
    ['title', 'category', 'summary', 'description'].forEach((key) => {if (typeof fields[key] === 'string') selected[key] = fields[key];});
    const custom = object(fields.custom) ? fields.custom : null;
    // No private_note, terms, contact details, adapter options or other custom
    // keys are read or copied into this card's display projection.
    const publicCustom = {};
    if (custom) ['description', 'scope'].forEach((key) => {if (typeof custom[key] === 'string') publicCustom[key] = custom[key];});
    if (Object.keys(publicCustom).length) selected.custom = publicCustom;
    const descriptions = [...new Set([selected.summary, selected.description, publicCustom.description].filter((value) => typeof value === 'string' && value.trim()))];
    const summary = descriptions.join(' ');
    const scope = typeof publicCustom.scope === 'string' ? publicCustom.scope : '';
    const excerpt = (value) => value.length > 420 ? value.slice(0, 417) + '...' : value;
    const legs = {};
    ['offer', 'want'].forEach((key) => {
      if (!Array.isArray(fields[key])) {legs[key] = null; return;}
      legs[key] = fields[key].map(publicLeg).filter((value) => value !== null);
      selected[key] = legs[key].map((value) => value.view);
    });
    return {title: selected.title || 'Public service advert', category: selected.category || '',
      summary: excerpt(summary), scope: excerpt(scope), excerpted: summary.length > 420 || scope.length > 420,
      offers: legs.offer === null ? null : legs.offer.map((value) => value.label),
      wants: legs.want === null ? null : legs.want.map((value) => value.label), selectedFields: selected};
  }
  const exported = {personalizedPageRank, rankNavigation, taskIntent, intentRules: INTENT_RULES, catalogue: CATALOGUE, normalizeServiceQuery, publicLeg, publicListingDisplay};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (typeof document === 'undefined') return;

  const ENDPOINT = 'https://jupie202020.pythonanywhere.com/mcp';
  const PUBLIC_ORIGIN = new URL(ENDPOINT).origin;
  const PUBLISHED_PAGE = 'https://covenant-common.github.io/covenant-docs/docs/TERMINAL.html';
  const liveSearchAllowed = window.location.origin === new URL(PUBLISHED_PAGE).origin;
  const PROTOCOL = '2025-11-25';
  const $ = (id) => document.getElementById(id);
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const accessName = {public: 'public tools', account: 'approved account', installed: 'private build'};
  let initialization = null;
  let sequence = 0;
  let busy = false;
  let nextOffset = null;
  let currentQuery = '';
  let currentQueryNotice = 'Search: all current public adverts.';
  const displayed = new Set();
  const handoffUrls = new Set();

  function node(tag, value, parent) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (parent) parent.appendChild(element);
    return element;
  }
  function showRoutes() {
    const need = $('terminal-query').value.trim();
    const result = rankNavigation(CATALOGUE, need, $('terminal-access').value);
    $('terminal-routes').replaceChildren();
    if (!result.matched) {
      $('terminal-route-state').textContent = result.reason === 'ACCESS_REQUIRED' ? 'That task needs account or private-build access. Choose all capabilities to see its route and requirements; the full directory is always below.' : 'No route at this access level matches those words. Try another phrase, choose all capabilities, or use the full directory below.';
      return;
    }
    result.routes.slice(0, 6).forEach((route) => {
      const item = document.createElement('li');
      const link = node('a', route.title, item);
      link.href = route.href;
      node('span', accessName[route.access] + (result.intent && route.taskPriority === 0 ? ' · matches your task' : result.intent ? ' · related step' : route.directMatch ? ' · direct word match' : ' · general route'), item).className = 'access';
      node('p', route.summary, item);
      $('terminal-routes').appendChild(item);
    });
    $('terminal-route-state').textContent = need ? 'Routes for “' + need + '”. Requested task first; graph fit ranks its eligible related routes.' : 'A general starting map. Enter a need to personalise these routes locally.';
  }
  async function boundedText(response) {
    const MAX = 524288;
    const declared = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(declared) && declared > MAX) throw new Error('The public reply is too large. Try a narrower search.');
    if (!response.body || typeof response.body.getReader !== 'function') {
      const value = await response.text();
      if (new TextEncoder().encode(value).length > MAX) throw new Error('The public reply is too large.');
      return value;
    }
    const reader = response.body.getReader();
    const pieces = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX) throw new Error('The public reply is too large. Try a narrower search.');
        pieces.push(part.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {reader.releaseLock();}
    const bytes = new Uint8Array(size);
    let offset = 0;
    pieces.forEach((piece) => {bytes.set(piece, offset); offset += piece.byteLength;});
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  }
  async function rpc(method, params, initial = false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const id = ++sequence;
    const headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'};
    if (!initial) headers['MCP-Protocol-Version'] = PROTOCOL;
    try {
      const response = await fetch(ENDPOINT, {method: 'POST', headers,
        mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: controller.signal,
        body: JSON.stringify({jsonrpc: '2.0', id, method, params})});
      if (response.status === 429) throw new Error('The pilot is busy. Wait a minute and try again.');
      if (!response.ok) throw new Error('The pilot did not complete this request (HTTP ' + response.status + ').');
      const value = JSON.parse(await boundedText(response));
      if (!isObject(value) || value.jsonrpc !== '2.0' || value.id !== id || value.error || !isObject(value.result)) throw new Error('The service returned an unexpected or refused reply.');
      return value.result;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('The pilot did not reply in time. No automatic retry was made.');
      if (error instanceof TypeError) throw new Error('The hosted service could not be reached from this page. See the connection and availability guide.');
      if (error instanceof SyntaxError) throw new Error('The service did not return valid JSON. No inventory was accepted.');
      throw error;
    } finally {clearTimeout(timeout);}
  }
  async function publicSearch(query, offset) {
    if (!initialization) initialization = rpc('initialize', {protocolVersion: PROTOCOL,
      capabilities: {}, clientInfo: {name: 'covenant-terminal', version: '1.0'}}, true)
      .then((value) => {if (value.protocolVersion !== PROTOCOL) throw new Error('Unsupported protocol version.');})
      .catch((error) => {initialization = null; throw error;});
    await initialization;
    const result = await rpc('tools/call', {name: 'aap_public_listing_search', arguments: {query, offset, limit: 5}});
    if (!Array.isArray(result.content) || result.content.length !== 1 || result.content[0].type !== 'text' || typeof result.content[0].text !== 'string') throw new Error('Unexpected public search format.');
    const wrapped = JSON.parse(result.content[0].text);
    if (result.isError === true) throw new Error('The service refused this search. Use at most eight words and check the public tool schema.');
    const data = isObject(wrapped) ? wrapped.result : null;
    if (!isObject(data) || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 || data.scope !== 'CURRENT_INDEXED_PUBLICATIONS_ONLY') throw new Error('Unexpected public inventory. No total was accepted.');
    // Validate the complete page before displaying any new item.
    data.items.forEach((item) => {
      const p = isObject(item) ? item.publication : null;
      if (!isObject(p) || !isObject(p.fields) || typeof p.id !== 'string' || !/^[0-9a-f]{64}$/.test(p.id) || p.visibility !== 'INDEXED') throw new Error('Unexpected publication. No private or unlisted record was accepted.');
    });
    return data;
  }
  function listingUrl(value) {
    try {
      const url = new URL(value);
      return url.origin === PUBLIC_ORIGIN && url.pathname.startsWith('/marketplace/') && !url.username && !url.password ? url.href : null;
    } catch (_) {return null;}
  }
  function renderListing(publication) {
    const card = publicListingDisplay(publication.fields);
    const item = document.createElement('li');
    const heading = node('h3', '', item);
    const url = typeof publication.url === 'string' ? listingUrl(publication.url) : null;
    if (url) {const a = node('a', card.title, heading); a.href = url;} else heading.textContent = card.title;
    if (card.category) node('p', card.category + ' · owner-published', item).className = 'record-meta';
    if (card.summary) node('p', card.summary, item);
    if (card.scope) node('p', 'Scope: ' + card.scope, item);
    if (card.offers && card.offers.length) node('p', 'Offers: ' + card.offers.join('; '), item);
    if (card.wants && card.wants.length) node('p', 'Wants: ' + card.wants.join('; '), item);
    else if (card.wants !== null) node('p', 'No requested consideration is published here; do not infer that the service is free.', item);
    if (card.excerpted) node('p', 'Description excerpt; inspect the public advert for the complete terms.', item).className = 'record-meta';
    const structure = node('button', 'Structure this deal', item); structure.type = 'button';
    structure.disabled = !window.AAPDealStructures;
    const handoffState = node('p', '', item); handoffState.setAttribute('role', 'status'); handoffState.setAttribute('aria-live', 'polite');
    let handoffPanel = null;
    structure.addEventListener('click', async () => {
      structure.disabled = true;
      handoffState.textContent = 'Preparing an explicit public advert handoff locally…';
      try {
        const handoff = await window.AAPDealStructures.makeHandoff(publication);
        const raw = JSON.stringify(handoff, null, 2);
        if (handoffPanel) handoffPanel.remove();
        handoffPanel = document.createElement('div');
        const url = URL.createObjectURL(new Blob([raw], {type: 'application/json;charset=utf-8'}));
        handoffUrls.add(url);
        const download = node('a', '1. Download public advert handoff', handoffPanel);
        download.href = url; download.download = 'aap-public-advert-' + handoff.advert.id.slice(0, 12) + '.json';
        node('span', ' · ', handoffPanel);
        const composer = node('a', '2. Open the Matrix composer and load the file', handoffPanel);
        composer.href = 'MATRIX.html#draft-work';
        const inspect = document.createElement('details'); node('summary', 'Copy or inspect the public handoff instead', inspect);
        node('p', 'This contains only selected public advert fields. It is not the exact signed source offer; provenance remains unverified.', inspect);
        const pre = node('pre', raw, inspect); pre.tabIndex = 0;
        const copy = node('button', 'Copy public handoff JSON', inspect); copy.type = 'button';
        copy.addEventListener('click', async () => {
          try {if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(raw); handoffState.textContent = 'Public handoff copied. Paste it into the Matrix handoff loader.';}
          catch (_) {inspect.open = true; pre.focus(); handoffState.textContent = 'Select and copy the handoff JSON below, then paste it into the Matrix loader.';}
        });
        handoffPanel.appendChild(inspect); item.appendChild(handoffPanel);
        handoffState.textContent = 'Public handoff ready. Choose a reusable structure in Matrix. Loading the file is local; fetch and verify the exact source before signing.';
      } catch (error) {handoffState.textContent = 'This advert could not be handed off: ' + error.message;}
      finally {structure.disabled = false;}
    });
    const details = document.createElement('details');
    node('summary', 'displayed public fields', details);
    node('p', 'Publication ID: ' + publication.id, details);
    node('p', 'This is the card display, not the exact signed publication. Open the public advert to inspect the original record.', details);
    node('pre', JSON.stringify(card.selectedFields, null, 2), details);
    item.appendChild(details);
    return item;
  }
  function previewNotice() {
    const state = $('terminal-market-state');
    state.replaceChildren();
    node('span', 'Local preview: live listings are available on the published site. ', state);
    const link = node('a', 'Open the live terminal', state);
    link.href = PUBLISHED_PAGE;
    $('terminal-find').disabled = true;
    $('terminal-find').textContent = 'live search: published site';
    $('terminal-more').hidden = true;
  }
  async function search(append = false) {
    if (!liveSearchAllowed) {previewNotice(); return;}
    if (busy) return;
    const normalised = append ? {query: currentQuery, notice: currentQueryNotice} : normalizeServiceQuery($('terminal-query').value);
    const query = normalised.query;
    const queryNotice = normalised.notice;
    if (query.length > 120 || query.split(/\s+/).filter(Boolean).length > 8) {
      $('terminal-market-state').textContent = 'Use up to eight literal search words; the typed need is unchanged. For a longer explanation, choose “map this need”. ' + queryNotice;
      return;
    }
    if (append && !Number.isSafeInteger(nextOffset)) return;
    const offset = append ? nextOffset : 0;
    if (!append) {currentQuery = query; currentQueryNotice = queryNotice; displayed.clear(); $('terminal-listings').replaceChildren();}
    busy = true;
    $('terminal-find').disabled = true;
    $('terminal-more').disabled = true;
    $('terminal-more').hidden = true;
    $('terminal-market-state').textContent = 'Reading current public adverts... ' + queryNotice;
    try {
      const result = await publicSearch(query, offset);
      result.items.forEach(({publication}) => {
        if (displayed.has(publication.id)) return;
        displayed.add(publication.id);
        $('terminal-listings').appendChild(renderListing(publication));
      });
      nextOffset = Number.isSafeInteger(result.next_offset) && result.next_offset >= 0 && result.next_offset <= 5000 ? result.next_offset : null;
      $('terminal-more').hidden = nextOffset === null;
      const checked = new Date().toISOString().slice(11, 19) + ' UTC';
      $('terminal-market-state').textContent = (result.total === 0 ? 'No public adverts matched. Try another search, or be among the first to advertise your service. Checked ' + checked + '.' : displayed.size + ' displayed; ' + result.total + ' matched this public search. Checked ' + checked + '. Listings can change between pages.') + ' ' + queryNotice;
    } catch (error) {
      nextOffset = null;
      $('terminal-market-state').textContent = 'Public search unavailable: ' + error.message + (displayed.size ? ' Previously loaded adverts remain below; they have not been refreshed.' : ' This is not an empty-inventory result.') + ' ' + queryNotice;
    } finally {
      busy = false;
      $('terminal-find').disabled = false;
      $('terminal-more').disabled = false;
    }
  }
  $('terminal-search').addEventListener('submit', (event) => {event.preventDefault(); search(false);});
  $('terminal-more').addEventListener('click', () => search(true));
  $('terminal-route').addEventListener('click', showRoutes);
  $('terminal-access').addEventListener('change', showRoutes);
  $('terminal-copy').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(ENDPOINT);
      $('terminal-copy-state').textContent = 'Public MCP address copied. No credential is included.';
    } catch (_) {
      $('terminal-mcp').focus();
      $('terminal-copy-state').textContent = 'Clipboard access was unavailable. Select and copy the address above.';
    }
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      $('help').open = false;
      if (editing && typeof target.blur === 'function') target.blur();
      return;
    }
    if (editing) return;
    if (event.key === '/') {event.preventDefault(); $('terminal-query').focus();}
    if (event.key === '?') {event.preventDefault(); $('help').open = true; $('help').querySelector('summary').focus();}
  });
  window.addEventListener('pagehide', () => handoffUrls.forEach((url) => URL.revokeObjectURL(url)));
  $('terminal-find').disabled = !liveSearchAllowed;
  $('terminal-route').disabled = false;
  if (liveSearchAllowed) search(false); else previewNotice();

})();
