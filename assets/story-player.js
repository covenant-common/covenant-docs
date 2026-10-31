/* Original fictional stories. No network requests, signing, storage or execution. */
(function (global) {
  'use strict';
  var stories = typeof module === 'object' && module.exports ? require('./story-scripts.js') : global.AAPStories;
  var characters = typeof module === 'object' && module.exports ? require('./story-characters.js') : global.AAPCharacters;
  function initial(episode) { return { episode: episode || 0, scene: 0, branch: null, playing: false }; }
  function transition(state, action) {
    var next = Object.assign({}, state);
    if (action.type === 'episode' && Number.isInteger(action.index) && action.index >= 0 && action.index < stories.episodes.length) return initial(action.index);
    if (action.type === 'branch' && state.scene >= 2 && (action.value === 'within' || action.value === 'breach')) next.branch = action.value;
    if (action.type === 'previous' && state.scene > 0) { next.scene--; next.playing = false; if (next.scene < 2) next.branch = null; }
    if (action.type === 'next' || action.type === 'tick') {
      if (state.scene === 2 && !state.branch) return Object.assign({}, state, { playing: false });
      if (state.scene === 4) return action.type === 'tick' ? Object.assign({}, state, { playing: false }) : initial(state.episode);
      next.scene++;
      if (next.scene === 2 || next.scene === 4) next.playing = false;
    }
    if (action.type === 'play') next.playing = state.scene === 4 || state.scene === 2 && !state.branch ? false : !state.playing;
    return next;
  }
  function view(state) {
    var episode = stories.episodes[state.episode], scene = episode.scenes[state.scene];
    var outcome = state.branch && state.scene >= 2 ? episode.outcomes[state.branch] : null;
    var dialogue = scene.dialogue, narration = scene.narration, poses = scene.poses;
    if (outcome && state.scene === 2) { narration = state.branch === 'within' ? episode.rule.allowed : episode.rule.blocked; poses = outcome.poses; }
    if (outcome && state.scene === 3) { narration = outcome.intervention; dialogue = outcome.dialogue; poses = outcome.poses; }
    if (outcome && state.scene === 4) { narration = outcome.consequence; dialogue = outcome.dialogue; poses = outcome.poses; }
    return { episode: episode, scene: scene, outcome: outcome, dialogue: dialogue, narration: narration, poses: poses };
  }
  var api = { initial: initial, transition: transition, view: view };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.AAPStoryPlayer = api;
  if (typeof document === 'undefined') return;
  var root = document.getElementById('story-player');
  if (!root || !stories || !characters) return;
  var state = initial(), timer = null, motion = !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var el = function (id) { return document.getElementById(id); };
  function text(id, value) { el(id).textContent = value; }
  function pose(id, who, expression, side, instance) { el(id).innerHTML = characters.render(who, expression, side, instance); }
  var props = {
    brief: '<path d="M46 16h108l30 31v140H46z" fill="#fff8e7"/><path d="M154 16v31h30M67 72h94M67 94h76M67 116h86M67 138h58"/><path d="M126 175l48-65 12 10-48 65z" fill="#e9ac6d"/>',
    code: '<path d="M20 34h190v125H20z" fill="#183c4a"/><path d="M31 45h168v101H31z" fill="#b7dce0"/><path d="M7 160h216l-17 18H26z" fill="#729ba6"/><path d="M91 72L69 96l22 24m45-48 22 24-22 24m-18-51-13 55" fill="none"/>',
    crate: '<path d="M29 57l88-32 89 32v114l-89 32-88-32z" fill="#d7b18a"/><path d="M29 57l88 33 89-33M117 90v113M73 41l88 32v40l-20 8V80L53 49" fill="#ebcda6"/><path d="M144 140l17 17 30-39" fill="none"/>',
    art: '<path d="M53 12h131v167H53z" fill="#fff8e7"/><path d="M65 24h107v143H65z" fill="#b8dade"/><path d="M65 145l36-78 29 49 18-29 24 58z" fill="#728d9e"/><circle cx="142" cy="58" r="18" fill="#eab07e"/><path d="M83 179l-16 34m86-34 17 34"/>',
    key: '<circle cx="91" cy="72" r="36" fill="#eac68c"/><circle cx="91" cy="72" r="14" fill="#e4f0ec"/><path d="M115 99l65 65-17 17-16-16-14 14-16-16 13-14-32-32z" fill="#eac68c"/>',
    network: '<rect x="28" y="29" width="77" height="135" rx="12" fill="#4f7384"/><path d="M36 42h61v99H36z" fill="#c5e8e5"/><rect x="139" y="64" width="65" height="109" rx="10" fill="#879ca5"/><path d="M146 75h51v77h-51z" fill="#fff4da"/><path d="M109 66q22-26 44 0m-37 12q15-17 30 0M82 187h90" fill="none"/><circle cx="66" cy="151" r="3"/><circle cx="171" cy="161" r="3"/>'
  };
  function render() {
    if (timer) { global.clearTimeout(timer); timer = null; }
    var current = view(state), episode = current.episode;
    document.documentElement.dataset.storyMotion = motion ? 'running' : 'paused';
    root.dataset.episode = ['research','software','supply-chain','licensing','delegation','network'][state.episode]; root.dataset.branch = state.branch || 'undecided'; root.dataset.motion = motion ? 'running' : 'paused';
    text('story-topic', episode.topic); text('story-title', episode.title); text('story-logline', episode.logline);
    text('story-setting', episode.setting); text('story-count', 'Scene ' + (state.scene + 1) + ' of 5');
    text('story-scene-title', current.scene.title); text('story-narration', current.narration);
    text('story-rule-label', episode.rule.label); text('story-rule', episode.rule.agreed);
    text('story-takeaway', episode.takeaway);
    text('story-ticket-label', current.outcome ? current.outcome.label : state.scene === 2 ? 'Your decision' : 'The agreed terms');
    text('story-ticket-body', current.outcome ? state.scene === 4 ? 'A clear next step. The original agreement stays intact.' : current.outcome.intervention : state.scene === 2 ? 'Try both choices below. Watch what changes.' : episode.rule.agreed);
    el('story-ticket').hidden = state.scene < 1;
    for (var i = 0; i < 2; i++) {
      var person = episode.cast[i], line = current.dialogue.find(function (entry) { return entry.who === person; });
      pose('story-actor-' + i, person, current.poses[i], i ? 'right' : 'left', 'scene' + i);
      text('story-person-' + i, stories.cast[person].name); text('story-role-' + i, stories.cast[person].role);
      text('story-line-' + i, line ? line.text : ''); el('story-bubble-' + i).hidden = !line;
    }
    el('story-prop').innerHTML = '<svg viewBox="0 0 240 230" aria-hidden="true" fill="none" stroke="#264858" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' + props[current.scene.prop] + '</svg>';
    el('story-choice').hidden = state.scene < 2;
    root.querySelector('[data-branch="within"]').textContent = episode.outcomes.within.action;
    root.querySelector('[data-branch="breach"]').textContent = episode.outcomes.breach.action;
    text('story-choice-note', state.branch ? 'Switch the choice to see the other consequence. No action is being executed.' : 'Choose an attempt to continue the story.');
    root.querySelectorAll('[data-branch]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.branch === state.branch)); });
    root.querySelectorAll('[data-episode]').forEach(function (button, index) { button.setAttribute('aria-pressed', String(index === state.episode)); });
    root.querySelectorAll('[data-scene]').forEach(function (button, index) { button.setAttribute('aria-current', index === state.scene ? 'step' : 'false'); button.disabled = index > state.scene; });
    el('story-previous').disabled = state.scene === 0;
    el('story-next').disabled = state.scene === 2 && !state.branch;
    text('story-next', state.scene === 4 ? 'Replay this story ↺' : 'Next scene →');
    text('story-play', state.playing ? 'Pause story' : 'Play story');
    el('story-play').setAttribute('aria-pressed', String(state.playing));
    el('story-play').disabled = state.scene === 4 || state.scene === 2 && !state.branch;
    text('story-motion', motion ? 'Pause gestures' : 'Enable gestures');
    el('story-motion').setAttribute('aria-pressed', String(!motion));
    el('story-link').href = episode.link.href; text('story-link', episode.link.label + ' →');
    text('story-announcement', episode.title + '. Scene ' + (state.scene + 1) + '. ' + current.scene.title + '. ' + current.narration);
    if (state.playing) timer = global.setTimeout(function () { state = transition(state, { type: 'tick' }); render(); }, 9000);
  }
  root.querySelectorAll('[data-episode]').forEach(function (button, index) { button.addEventListener('click', function () { state = transition(state, { type: 'episode', index: index }); render(); }); });
  root.querySelectorAll('[data-branch]').forEach(function (button) { button.addEventListener('click', function () { state = transition(state, { type: 'branch', value: button.dataset.branch }); render(); }); });
  el('story-previous').addEventListener('click', function () { state = transition(state, { type: 'previous' }); render(); });
  el('story-next').addEventListener('click', function () { state = transition(state, { type: 'next' }); render(); });
  el('story-play').addEventListener('click', function () { state = transition(state, { type: 'play' }); render(); });
  el('story-motion').addEventListener('click', function () { motion = !motion; render(); });
  root.querySelectorAll('[data-scene]').forEach(function (button, index) { button.addEventListener('click', function () { if (index <= state.scene) { state.scene = index; state.playing = false; if (index < 2) state.branch = null; render(); } }); });
  pose('hero-akari', 'akari', 'thinking', 'left', 'hero-akari'); pose('hero-ren', 'ren', 'hopeful', 'right', 'hero-ren');
  var castGrid = el('story-cast-list');
  Object.keys(stories.cast).forEach(function (id) {
    var person = stories.cast[id], article = document.createElement('article'), name = document.createElement('strong'), line = document.createElement('p');
    name.textContent = person.name + ' · ' + person.role; line.textContent = person.personality; article.append(name, line); castGrid.appendChild(article);
  });
  root.dataset.ready = 'true'; render();
})(typeof globalThis === 'object' ? globalThis : this);
