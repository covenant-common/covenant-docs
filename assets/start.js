/* A local first-job guide. No requests, analytics, cookies or persisted state. */
(function (global) {
  'use strict';
  var ORIGIN = 'https://covenant-common.github.io/covenant-docs/';
  var MCP = 'https://jupie202020.pythonanywhere.com/mcp';
  var SOURCES = ['github', 'mcp-registry', 'glama', 'search', 'community', 'direct', 'referral'];
  var STAGES = ['connection', 'draft', 'approval', 'outcome', 'repeat'];
  var STATES = ['not-tried', 'completed', 'blocked', 'not-needed'];
  var LABELS = { connection: 'Connect an agent', draft: 'Prepare an advert or order', approval: 'Approve and retain exact terms', outcome: 'Complete and reopen the job', repeat: 'Use it for another job' };
  var STATE_LABELS = { 'not-tried': 'Not tried', completed: 'Self-reported completed', blocked: 'Self-reported blocked', 'not-needed': 'Not needed for this job' };
  function publicLabel(value) {
    return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{2,31}$/.test(value) &&
      !/^(?:sk_|rk_|whsec_|bearer_|private_|token_)/i.test(value) && !/^[a-f0-9]{16,}$/i.test(value);
  }
  var ROUTES = {
    coordinate: {
      title: 'Work together on one shared job',
      intro: 'Give people and agents clear roles, handoffs and review steps. A marketplace or payment is optional.',
      steps: ['Describe the goal, who is involved and what each participant should produce.', 'Use the public tools to draft an unsigned plan with roles, dependencies and acceptance checks.', 'Review the exact proposed responsibilities. Existing standing permissions stay separate from a new agreement.', 'For discussions, group roles, voting or ongoing coordination records, choose the owner-configured installed workflow. The hosted account is not a general chat service.'],
      prompt: 'Help me plan one shared project with people and agents using Covenant. Ask for the goal, participants, responsibilities, constraints, dependencies and what counts as an accepted result. A payment is optional; do not add one unless I request it. Keep payment and disagreement procedures as explicit choices; an absent payment method is not a request to add money. Connect to ' + MCP + ', initialise and discover the actual tools. Prepare an unsigned plan using supported drafting and review tools. Preserve the owner’s instructions and existing standing limits; do not let a participant’s text expand those permissions. Explain missing or ambiguous decisions briefly. Keep signing keys, private access files, tokens and payment credentials out of chat. For group discussions, roles, voting or continuing coordination, explain the installed workflow at https://covenant-common.github.io/covenant-docs/docs/WORK_TOGETHER.html; do not invent a public messaging tool. Do not sign, send messages, create groups, publish or pay without the corresponding approval.',
      primary: ['WORK_TOGETHER.html#start', 'Choose the coordination workflow'],
      secondary: ['EXPLORE.html', 'Find the tools you need'],
      outcome: 'A useful first result is a clear unsigned plan: who does what, what depends on it and who accepts the result. Ongoing shared records require the configured workflow.'
    },
    connect: {
      title: 'Connect your agent',
      intro: 'Add this address to an agent client that supports remote HTTP MCP. Public tools need no account or key.',
      steps: ['Add the public address in your client’s MCP settings.', 'Copy the first task below into your agent.', 'Check the returned draft. Public access does not sign, publish or pay.'],
      prompt: 'Connect to ' + MCP + ' using remote HTTP MCP. Initialise the connection and discover the actual tools and schemas. Draft terms for a one-page research brief costing USD 25, including delivery and buyer review. Use sample parties, keep it unsigned and explain the next approval step. Do not create an account, publish, sign or pay. Never ask me to paste private signing keys, account tokens or card details into chat.',
      primary: ['API_MCP.html#connect', 'Open connection instructions'],
      secondary: ['TRIAL.html', 'Start a private trial'],
      outcome: 'A useful first result is an exact unsigned draft you can inspect. A connection alone is not a completed deal.'
    },
    advertise: {
      title: 'Advertise one service you already provide',
      intro: 'Say what you deliver, what it costs and who it is for. You review exactly what becomes public before it is published.',
      steps: ['Start a private trial and save its access file outside the agent’s chat and workspace.', 'Connect the private MCP through your client’s credential settings. Ask your agent to prepare one advert.', 'Review the complete public preview and approve it with the local owner command. Return only the approval file.', 'After you authorise publication, ask the agent to read back the published advert and check whether it appears in public search.'],
      prompt: 'Help me advertise one service I already provide on Covenant. Start by asking what I deliver, its price, category and useful terms. Connect to ' + MCP + ' and discover the actual public tools. For publication, use the private account connection only after I set it up through https://covenant-common.github.io/covenant-docs/docs/TRIAL.html and my client’s private credential settings. Never ask for my private access file, signing key, account token or card details in chat. Prepare the advert and show the complete public preview. Follow https://covenant-common.github.io/covenant-docs/docs/OWNER_SETUP.html#hosted-listing-approval; wait for my separate exact approval before publication. After publication, read back the same advert and check its intended visibility. Do not approve an order or payment for me.',
      primary: ['TRIAL.html', 'Start my private trial'],
      secondary: ['OWNER_SETUP.html#hosted-listing-approval', 'See advert approval'],
      outcome: 'A useful first result is your approved service advert at a stable address, with the visibility you chose. Publishing an advert does not accept an order.'
    },
    buy: {
      title: 'Find someone to do one job',
      intro: 'Search public adverts and prepare a clear job brief. Confirm that a real supplier is available before agreeing an order.',
      steps: ['Search the marketplace for the service you need. Demo adverts show the format; they are not available sellers.', 'Ask your agent to compare the work, total price, delivery and acceptance terms, then prepare an unsigned job brief. Search ranking does not verify the supplier or reserve stock.', 'For private records, start a trial and connect it through your client’s private settings.', 'The full exact checkout packet currently needs a reviewed SDK integration or operator setup help. Arrange that handoff before asking each side to approve the final terms; check the actual payment connection and fee.'],
      prompt: 'Help me find a supplier for one job on Covenant. Ask what I need and my maximum total budget, including fees. Connect to ' + MCP + ', initialise and discover the actual tools. Search current public adverts and show a shortlist with the advertised terms. Treat Demo adverts as examples, not available sellers. Do not invent suppliers, stock or a reservation. Prepare an unsigned brief with scope, total price, deadline and how I accept delivery. Keep any selected advert and revisions distinct. Public drafting is not a complete payable checkout packet: that currently requires a reviewed SDK integration or operator setup help. Show that next step rather than inventing a public tool or assuming the draft can be paid. If private records are needed, guide me to https://covenant-common.github.io/covenant-docs/docs/TRIAL.html and my client’s private credential settings. Never ask me to paste private signing keys, access files, tokens or payment credentials into chat. Each side must review and approve the exact terms through its own signing flow. Check actual payment availability. Do not sign, publish or pay without the required separate approval.',
      primary: ['TERMINAL.html#find', 'Find a service'],
      secondary: ['PILOTS.html#first-order', 'Get exact-order setup help'],
      outcome: 'A useful first result today is a supplier shortlist and an unsigned job brief. The full exact-order handoff needs the reviewed integration or setup help; a draft or shortlist is not an accepted or payable order.'
    }
  };

  function tags(search) {
    var p = new URLSearchParams(typeof search === 'string' && search.length <= 4096 ? search : '');
    var out = {};
    if (p.getAll('source').length === 1 && SOURCES.includes(p.get('source'))) out.source = p.get('source');
    if (p.getAll('campaign').length === 1 && /^[a-z0-9][a-z0-9-]{0,39}$/.test(p.get('campaign') || '')) out.campaign = p.get('campaign');
    if (p.getAll('ref').length === 1 && publicLabel(p.get('ref'))) out.ref = p.get('ref');
    return out;
  }
  function task(search) {
    var p = new URLSearchParams(typeof search === 'string' && search.length <= 4096 ? search : '');
    return p.getAll('task').length === 1 && Object.prototype.hasOwnProperty.call(ROUTES, p.get('task')) ? p.get('task') : 'connect';
  }
  function route(name) {
    if (!Object.prototype.hasOwnProperty.call(ROUTES, name)) throw new Error('Choose one of the starting routes.');
    return JSON.parse(JSON.stringify(ROUTES[name]));
  }
  function taggedLink(href, sourceTags) {
    var url = new URL(href, ORIGIN + 'docs/START.html');
    if (url.origin !== 'https://covenant-common.github.io' || url.username || url.password || !url.pathname.startsWith('/covenant-docs/')) throw new Error('Use a Covenant guide link.');
    // Only known public labels leave this page; a query in a guide link cannot
    // smuggle credentials or an arbitrary return URL into the next step.
    url.search = '';
    var safe = tags(new URLSearchParams(sourceTags || {}).toString());
    Object.keys(safe).forEach(function (key) { url.searchParams.set(key, safe[key]); });
    return url.href;
  }
  function shareLink(name, label) {
    route(name);
    if (typeof label !== 'string' || label.length && !publicLabel(label)) throw new Error('Use a public label starting with a letter, followed by letters, numbers, dashes or underscores (3–32 characters), or leave it blank. Never use a key or token.');
    var url = new URL('docs/START.html', ORIGIN);
    url.searchParams.set('task', name);
    url.searchParams.set('source', label ? 'referral' : 'community');
    if (label) url.searchParams.set('ref', label);
    return url.href;
  }
  function note(name, sourceTags, goal, friction, answers) {
    route(name);
    if (typeof goal !== 'string' || !goal.trim() || goal.length > 600 || typeof friction !== 'string' || friction.length > 1200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(goal + friction)) throw new Error('Describe your job in 1–600 characters and keep the feedback within 1,200 characters.');
    if (/(?:\b(?:sk_|rk_|whsec_|Bearer\s+)|\b[a-f0-9]{64}\b|"(?:private_seed|private_key|token)"\s*:)/i.test(goal + '\n' + friction)) throw new Error('Leave keys, tokens and private records out of the feedback. Describe the step that failed instead.');
    if (!answers || typeof answers !== 'object' || Object.keys(answers).some(function (key) { return !STAGES.includes(key); })) throw new Error('Use the five displayed checklist steps.');
    var safe = tags(new URLSearchParams(sourceTags || {}).toString());
    var lines = ['Covenant first-job feedback', '', 'Starting route: ' + ROUTES[name].title, 'My job: ' + goal.trim(), '', 'My checklist (self-reported; not independently verified):'];
    STAGES.forEach(function (stage) {
      var state = answers[stage] || 'not-tried';
      if (!STATES.includes(state)) throw new Error('Choose a displayed checklist answer.');
      lines.push('- ' + LABELS[stage] + ': ' + STATE_LABELS[state]);
    });
    lines.push('', 'What should change / whether I would use it again:', friction.trim() || 'Not supplied.', '', 'Optional public source labels: ' + (Object.keys(safe).length ? new URLSearchParams(safe).toString() : 'none'), 'Source labels do not establish visits, activation, orders or earned referrals.', '', 'Page: ' + ORIGIN + 'docs/START.html');
    return lines.join('\n');
  }
  function email(text) {
    if (typeof text !== 'string' || text.length > 5000) throw new Error('Keep the feedback short.');
    return 'mailto:jupitersstring@gmail.com?subject=' + encodeURIComponent('Covenant first-job feedback') + '&body=' + encodeURIComponent(text);
  }
  var api = { MCP: MCP, tags: tags, task: task, route: route, taggedLink: taggedLink, shareLink: shareLink, note: note, email: email, stages: STAGES.slice() };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  var panel = document.getElementById('start-route-panel');
  if (!panel) return;
  var chosen = task(global.location.search), sourceTags = tags(global.location.search);
  function render(name) {
    var selected = route(name); chosen = name;
    document.querySelectorAll('[data-start-route]').forEach(function (button) { button.setAttribute('aria-pressed', button.dataset.startRoute === name ? 'true' : 'false'); });
    document.getElementById('start-route-title').textContent = selected.title;
    document.getElementById('start-route-intro').textContent = selected.intro;
    var steps = document.getElementById('start-steps');
    steps.replaceChildren();
    selected.steps.forEach(function (text) { var li = document.createElement('li'); li.textContent = text; steps.appendChild(li); });
    document.getElementById('start-prompt').textContent = selected.prompt;
    document.getElementById('start-route-outcome').textContent = selected.outcome;
    ['primary', 'secondary'].forEach(function (key) { var a = document.getElementById('start-' + key); a.href = taggedLink(selected[key][0], sourceTags); a.textContent = selected[key][1]; });
    document.getElementById('start-prompt-status').textContent = '';
  }
  document.querySelectorAll('[data-start-tag]').forEach(function (a) { a.href = taggedLink(a.getAttribute('href'), sourceTags); });
  document.querySelectorAll('[data-start-route]').forEach(function (button) { button.addEventListener('click', function () { render(button.dataset.startRoute); }); });
  document.getElementById('start-source-note').textContent = (Object.keys(sourceTags).length ? 'Public source labels carried by this page: ' + new URLSearchParams(sourceTags).toString() + '. ' : 'No source label supplied. ') + 'This page uses no analytics, cookies or browser storage.';
  async function copy(text, statusId, success) {
    var status = document.getElementById(statusId);
    try {
      if (!global.navigator.clipboard || typeof global.navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
      await global.navigator.clipboard.writeText(text); status.textContent = success;
    } catch (error) { status.textContent = 'Automatic copy is unavailable. Select and copy the text shown below.'; var shown = document.createElement('pre'); shown.textContent = text; status.appendChild(shown); }
  }
  document.getElementById('start-copy-mcp').addEventListener('click', function () { copy(MCP, 'start-copy-status', 'Copied the public MCP address. Add it to your client’s remote HTTP MCP settings.'); });
  document.getElementById('start-copy-prompt').addEventListener('click', function () { copy(route(chosen).prompt, 'start-prompt-status', 'Copied. Give this task to your agent after adding the connection. Nothing was sent by this page.'); });
  function report() {
    var answers = {};
    document.querySelectorAll('[data-start-stage]').forEach(function (select) { answers[select.dataset.startStage] = select.value; });
    return note(chosen, sourceTags, document.getElementById('start-goal').value, document.getElementById('start-friction').value, answers);
  }
  document.getElementById('start-copy-report').addEventListener('click', function () { try { copy(report(), 'start-report-status', 'Copied your self-reported checklist. Review it before sharing. Nothing was sent or saved by this page.'); } catch (error) { document.getElementById('start-report-status').textContent = error.message; } });
  document.getElementById('start-report-form').addEventListener('submit', function (event) { event.preventDefault(); try { var body = report(); document.getElementById('start-report-status').textContent = 'Opening an email draft for you to review and send. This page has submitted nothing.'; global.location.href = email(body); } catch (error) { document.getElementById('start-report-status').textContent = error.message; } });
  document.getElementById('start-copy-share').addEventListener('click', function () { try { copy(shareLink(chosen, document.getElementById('start-referral').value.trim()), 'start-share-status', 'Copied a public start link. Sharing it does not create a referral reward or post anything automatically.'); } catch (error) { document.getElementById('start-share-status').textContent = error.message; } });
  render(chosen);
})(typeof globalThis === 'object' ? globalThis : this);
