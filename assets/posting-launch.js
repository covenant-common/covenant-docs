/* Dated launch copy only. This script cannot quote, waive or collect a fee. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.mount(root.document, function () { return Date.now(); }, root);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var START = Date.parse('2026-11-01T10:45:13Z');
  var END = Date.parse('2026-12-01T10:45:13Z');
  var NORMAL = 'Ordinary job and service posts are free. Promoted placements and deal fees are separate.';
  function stateAt(now) {
    var phase = typeof now !== 'number' || !Number.isFinite(now) ? 'unknown' :
      now < START ? 'scheduled' : now < END ? 'active' : 'ended';
    return Object.freeze({phase: phase, text: phase === 'active' ?
      'Hari’s List launch month · ' + NORMAL + ' The launch notice ends on 1 December 2026.' : NORMAL});
  }
  function mount(doc, clock, timers) {
    var nodes = doc.querySelectorAll('[data-posting-launch]');
    if (!nodes.length) return function () {};
    var timer = null, stopped = false;
    function refresh() {
      if (stopped) return;
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      var now = clock(), state = stateAt(now);
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].textContent !== state.text) nodes[i].textContent = state.text;
        nodes[i].setAttribute('data-launch-phase', state.phase);
      }
      if (state.phase === 'active' || state.phase === 'scheduled') {
        var next = state.phase === 'scheduled' ? START : END;
        timer = timers.setTimeout(refresh, Math.min(60000, Math.max(1, next - now)));
      }
    }
    function visible() { if (!doc.hidden) refresh(); }
    doc.addEventListener('visibilitychange', visible);
    refresh();
    return function () {
      stopped = true;
      if (timer !== null) timers.clearTimeout(timer);
      doc.removeEventListener('visibilitychange', visible);
    };
  }
  return Object.freeze({startsAt: START, endsAt: END, stateAt: stateAt, mount: mount});
});
