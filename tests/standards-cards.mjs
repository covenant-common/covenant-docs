import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync, readFileSync} from 'node:fs';
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

test('nav links do not wrap mid-word at 390px', async () => {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  try {
    const pages = ['/index.html', '/sandbox/index.html', '/docs/AGENTIC_COMMERCE.html']
      .filter((url) => existsSync(join(ROOT, url.replace(/^\//, ''))));
    for (const url of pages) {
      await page.goto('http://127.0.0.1:' + server.address().port + url, { waitUntil: 'domcontentloaded' });
      const wraps = await page.evaluate(() => [...document.querySelectorAll('.journey a, .site-nav a, .nav-links a')]
        .filter((link) => link.getClientRects().length > 1)
        .map((link) => link.textContent.trim()));
      assert.deepEqual(wraps, [], url);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the standards table becomes cards at 390px and does not clip', {skip: !existsSync(join(ROOT, 'docs/AGENTIC_COMMERCE.html'))}, async () => {
  const server = await serve();
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 390, height: 800}});
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/docs/AGENTIC_COMMERCE.html', {waitUntil: 'domcontentloaded'});
    const metrics = await page.evaluate(() => {
      const cell = document.querySelector('table.matrix td');
      const style = cell ? getComputedStyle(cell) : {display: ''};
      return {
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
        display: style.display,
        label: cell ? getComputedStyle(cell, '::before').content : ''
      };
    });
    assert.equal(metrics.display, 'block');
    assert.match(metrics.label, /Standard/);
    assert.ok(metrics.scroll <= metrics.inner + 1, JSON.stringify(metrics));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
