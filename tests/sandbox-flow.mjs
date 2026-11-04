import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {join, extname} from 'node:path';
import {chromium} from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};

function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = join(ROOT, path === '/' ? 'index.html' : path.replace(/^\//, ''));
    try {
      const body = readFileSync(file);
      res.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('missing');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('sandbox labels, stage and amount follow one state, including refund', async () => {
  const server = await serve();
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/sandbox/index.html', {waitUntil: 'domcontentloaded'});
    const propose = page.locator('#propose');
    await assert.equal(await propose.textContent(), 'Propose');
    await propose.click();
    await assert.equal(await propose.textContent(), 'Proposed');
    await assert.equal(await propose.isDisabled(), true);
    await assert.match(await page.locator('#step-status').textContent(), /PROPOSED/);
    await assert.match(await page.locator('#money').textContent(), /Held: 0/);
    await page.locator('#accept').click();
    await page.locator('#confirm-yes').click();
    await assert.match(await page.locator('#step-status').textContent(), /ACCEPTED/);
    await assert.doesNotMatch(await page.locator('#step-status').textContent(), /PROPOSED/);
    await assert.match(await page.locator('#receipt').textContent(), /Sample record rec-1/);
    await assert.match(await page.locator('#thread').textContent(), /Both/);
    await assert.match(await page.locator('#thread').textContent(), /T\d{2}:\d{2}:\d{2}/);
    await page.locator('#fund').click();
    await page.locator('#confirm-yes').click();
    await assert.match(await page.locator('#step-status').textContent(), /BOUND/);
    await assert.match(await page.locator('#money').textContent(), /Held: 20/);
    await page.locator('#deliver').click();
    await assert.match(await page.locator('#step-status').textContent(), /DELIVERED/);
    await assert.match(await page.locator('#step-status').textContent(), /20 test USDC/);
    await assert.doesNotMatch(await page.locator('#step-status').textContent(), /\b25\b/);
    await page.locator('#dispute').click();
    await page.locator('#refund').click();
    await page.locator('#confirm-yes').click();
    const status = await page.locator('#step-status').textContent();
    await assert.match(status, /Refunded/);
    await assert.doesNotMatch(status, /RELEASED/);
    await assert.match(status, /20 test USDC/);
    await assert.doesNotMatch(status, /REFUTED/);
    await assert.match(await page.locator('#money').textContent(), /Held: 0/);
    await assert.match(await page.locator('#money').textContent(), /Buyer has 100/);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
