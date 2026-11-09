/* Copy the public mcpServers example. The configuration contains no account token. */
(function (global) {
  'use strict';
  function copied(text) {
    return String(text || '').replace(/^\s+|\s+$/g, '') + '\n';
  }
  var api = { copied: copied };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  var source = document.getElementById('mcp-servers-config');
  var button = document.getElementById('copy-mcp-config');
  var status = document.getElementById('copy-mcp-config-status');
  if (!source || !button || !status) return;
  button.addEventListener('click', async function () {
    var text = copied(source.textContent);
    try {
      if (!global.navigator.clipboard || typeof global.navigator.clipboard.writeText !== 'function') throw new Error('unavailable');
      await global.navigator.clipboard.writeText(text);
      status.textContent = 'Copied the public mcpServers configuration. Nothing was sent by this page.';
    } catch (error) {
      status.textContent = 'Automatic copy is unavailable. Select and copy the configuration shown below.';
    }
  });
})(typeof globalThis === 'object' ? globalThis : this);
