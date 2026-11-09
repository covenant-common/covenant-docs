const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const copy = require('../assets/copy-mcp-config.js');

test('the public configuration copy keeps the visible JSON and reports clipboard failure', async () => {
  assert.equal(copy.copied('  {"mcpServers":{}}  '), '{"mcpServers":{}}\n');
  const writes = [];
  const status = { textContent: '' };
  const source = { textContent: '{\n  "mcpServers": {\n    "covenant-public": {}\n  }\n}' };
  const button = { handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
  const document = { getElementById(id) { return { 'mcp-servers-config': source, 'copy-mcp-config': button, 'copy-mcp-config-status': status }[id]; } };
  const context = { document, navigator: { clipboard: { async writeText(text) { writes.push(text); } } } };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/copy-mcp-config.js'), 'utf8'), context);
  await button.handlers.click();
  assert.equal(writes[0], source.textContent.trim() + '\n');
  assert.match(status.textContent, /Copied the public mcpServers configuration/);
  context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await button.handlers.click();
  assert.match(status.textContent, /Automatic copy is unavailable/);
});
