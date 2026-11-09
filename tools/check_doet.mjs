// People checklist for the shared layout. Exits 1 when a people item fails.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(fileURLToPath(import.meta.url));
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + id + (detail ? ' — ' + detail : ''));
}

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'technical') continue;
    const stat = statSync(path);
    if (stat.isDirectory()) htmlFiles(path, out);
    else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

const files = ['index.html', 'PRIVACY.html']
  .map((name) => join(ROOT, name))
  .concat(htmlFiles(join(ROOT, 'docs')))
  .concat([join(ROOT, 'sandbox/index.html')]);
let navFail = 0;
let footerFail = 0;
let journeyFail = 0;
for (const path of files) {
  const text = readFileSync(path, 'utf8');
  const rel = path.replace(ROOT + '/', '');
  const disputes = text.includes('Disputes &amp; refunds') || text.includes('Disputes & refunds');
  if (!text.includes('class="site-nav"') || !text.includes('Connect an agent') || !disputes) navFail += 1;
  if (!text.includes('>Terms<') || !text.includes('>Privacy<') || !text.includes('>Contact<') || !text.includes('Is this binding?')) footerFail += 1;
  const journey = text.match(/aria-label="Deal steps"[\s\S]*?<\/ol>/);
  if (!journey || !/Find[\s\S]*Agree[\s\S]*Pay[\s\S]*Deliver[\s\S]*Resolve/.test(journey[0])) journeyFail += 1;
  if (navFail + footerFail + journeyFail > 8) { record('layout-scan', false, rel); break; }
}
record('one-nav', navFail === 0, navFail ? navFail + ' pages missing the shared nav' : files.length + ' pages');
record('footer-links', footerFail === 0, footerFail ? footerFail + ' pages missing Terms, Privacy, Contact or binding' : 'present');
record('journey-order', journeyFail === 0, journeyFail ? journeyFail + ' pages have the steps out of order' : 'Find, Agree, Pay, Deliver, Resolve');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const people = ['/index.html', '/docs/PERSON.html', '/docs/AGENT.html', '/docs/PAYING.html', '/docs/NEGOTIATION.html', '/sandbox/index.html', '/docs/MATRIX.html'];
let smallHeadings = [];
let overflow = [];
let taps = [];
let axe = [];
for (const path of people) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  const size = await page.locator('h1').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (size < 28) smallHeadings.push(path + ' ' + size);
  const desktopAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  if (desktopAxe.violations.length) axe.push(path + ' desktop ' + desktopAxe.violations.map((v) => v.id).join(','));
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  const box = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (box.scroll !== box.client) overflow.push(path);
  const small = await page.evaluate(() => [...document.querySelectorAll('a, button, summary, label')].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return r.width < 44 || r.height < 44;
  }).length);
  if (small) taps.push(path + ' ' + small);
  const phoneAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  if (phoneAxe.violations.length) axe.push(path + ' 375 ' + phoneAxe.violations.map((v) => v.id).join(','));
}
record('h1-size', smallHeadings.length === 0, smallHeadings.join('; ') || 'at least 28px');
record('no-overflow-375', overflow.length === 0, overflow.join(', ') || 'scroll width matches');
record('tap-targets-44', taps.length === 0, taps.join('; ') || 'links, buttons, summaries and menu labels');
record('axe', axe.length === 0, axe.join('; ') || 'clean on the people path');

await page.setViewportSize({ width: 375, height: 800 });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
const menuClosed = await page.locator('.nav-links').evaluate((el) => getComputedStyle(el).display === 'none');
await page.locator('.nav-toggle-label').click();
const menuOpen = await page.locator('.nav-links').evaluate((el) => getComputedStyle(el).display !== 'none');
record('mobile-menu', menuClosed && menuOpen, 'closed then open at 375px');

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(BASE + '/docs/PAYING.html', { waitUntil: 'domcontentloaded' });
const paying = await page.locator('main').innerText();
record('usdc-status', /Not connected/.test(paying) && !/Connection installed/.test(paying), 'badge comes from the registry wording');

await page.goto(BASE + '/sandbox/index.html', { waitUntil: 'domcontentloaded' });
await page.reload({ waitUntil: 'domcontentloaded' });
const buttonBox = await page.locator('#propose').boundingBox();
record('sandbox-button', buttonBox && buttonBox.height >= 44 && buttonBox.width >= 44, JSON.stringify(buttonBox));
const py = await page.locator('#py-status').innerText();
record('download-progress', /19\.9 MB/.test(py), py.slice(0, 120));
const before = await page.locator('#propose').innerText();
await page.locator('#propose').click();
const after = await page.locator('#propose').innerText();
record('propose-once', before.trim() === 'Propose' && after.trim() === 'Proposed', before + ' -> ' + after);
const quoted = await page.locator('#money').innerText();
record('fee-before-accept', /not set yet/i.test(quoted), 'the quote says the fee is not set');
await page.locator('#counter').click();
await page.locator('#agree').click();
await page.locator('#accept').click();
await page.getByRole('button', { name: 'Yes, use test funds only' }).click();
await page.locator('#fund').click();
await page.getByRole('button', { name: 'Yes, use test funds only' }).click();
const held = await page.locator('#money').innerText();
await page.locator('#deliver').click();
await page.locator('#dispute').click();
await page.locator('#refund').click();
await page.getByRole('button', { name: 'Yes, use test funds only' }).click();
const done = await page.locator('#step-status').innerText();
const thread = await page.locator('#thread').innerText();
const receipt = await page.locator('#receipt').innerText();
record('step-by-step', /counters at 30/.test(thread) && /Buyer/.test(thread) && /Held: 25/.test(held) && /Sample record rec-/.test(receipt), 'history, record id and the 25 hold come from one state');
record('dispute-refund', /Refunded/.test(done) && !/RELEASED/.test(done) && !/REFUTED/.test(done) && /25 test USDC/.test(done), 'refund uses the held amount');
const afterRun = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
record('sandbox-no-overflow-after-run', afterRun, 'after the dispute branch');
record('plain-errors', !/COUNTERPARTY_ASSENT/.test(done), 'engine code is not the message');

await page.goto(BASE + '/docs/MATRIX.html', { waitUntil: 'domcontentloaded' });
await page.locator('#draft-currency').selectOption('USD');
await page.locator('#draft-amount').fill('a hundred quid maybe');
await page.locator('#draft-amount').dispatchEvent('input');
const priceError = await page.locator('#draft-amount-error').innerText();
const currencyError = await page.locator('#draft-currency-error').innerText();
const amountInvalid = await page.locator('#draft-amount').getAttribute('aria-invalid');
  const amountFocused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  record('matrix-price', /a hundred quid maybe/.test(priceError) && amountInvalid === 'true' && amountFocused === 'draft-amount' && currencyError.trim() === '', priceError);
await page.locator('#draft-currency').selectOption('');
await page.locator('#draft-amount').dispatchEvent('input');
const splitAmount = await page.locator('#draft-amount-error').innerText();
const splitCurrency = await page.locator('#draft-currency-error').innerText();
record('matrix-fields', /not a price/.test(splitAmount) && /Choose a currency/.test(splitCurrency), splitCurrency + ' | ' + splitAmount);
await page.locator('#draft-currency').selectOption('USD');
await page.locator('#draft-amount').fill('-25');
await page.locator('#draft-amount').dispatchEvent('input');
record('matrix-negative', /negative|not a price/.test(await page.locator('#draft-amount-error').innerText()), 'negative refused');

await page.setViewportSize({ width: 375, height: 800 });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
const onScreen = await page.evaluate(() => {
  const h1 = document.querySelector('h1').getBoundingClientRect();
  const sentence = [...document.querySelectorAll('main p')].map((p) => p.getBoundingClientRect()).find((box) => box.top < 800 && box.height > 0);
  return h1.bottom < 800 && !!sentence;
});
let searchTabs = 0;
let searchFound = false;
for (let i = 0; i < 4; i += 1) {
  await page.keyboard.press('Tab');
  searchTabs += 1;
  if (await page.evaluate(() => document.activeElement && document.activeElement.id === 'site-search')) { searchFound = true; break; }
}
const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
const matrix = readFileSync(join(ROOT, 'docs/MATRIX.html'), 'utf8');
const terminalJs = readFileSync(join(ROOT, 'assets/terminal.js'), 'utf8');
const startJs = readFileSync(join(ROOT, 'assets/start.js'), 'utf8');
const disputes = readFileSync(join(ROOT, 'docs/DISPUTES.html'), 'utf8');
const pass = (id) => results.some((row) => row.id === id && row.pass);
record('P1', pass('one-nav'), 'shared nav includes Connect an agent and Disputes & refunds');
record('P2', pass('mobile-menu') && pass('no-overflow-375') && pass('sandbox-no-overflow-after-run'), 'menu and overflow');
record('P3', pass('h1-size') && onScreen, 'heading and a sentence are on the 375px screen');
record('P4', searchFound && searchTabs <= 3, 'search focused in ' + searchTabs + ' tabs');
record('P5', /badge-test/.test(terminalJs) && /hide-test-listings/.test(terminalJs), 'Test badge and filter');
record('P6', /broader word/.test(terminalJs), 'empty-search suggestion');
record('P7', /Make an offer/.test(terminalJs) && /MATRIX\.html\?title=/.test(terminalJs), 'offer control pre-fills the composer');
record('P8', /id="draft-currency"/.test(matrix) && pass('matrix-price'), 'currency selector and inline refusal');
record('P9', /name="draft-role"/.test(matrix) && /Unsigned ' \+ role/.test(readFileSync(join(ROOT, 'assets/matrix.js'), 'utf8')), 'role label');
record('P10', /id="thread"/.test(readFileSync(join(ROOT, 'sandbox/index.html'), 'utf8')) && /id="decline"/.test(readFileSync(join(ROOT, 'sandbox/index.html'), 'utf8')) && /id="counter"/.test(readFileSync(join(ROOT, 'sandbox/index.html'), 'utf8')), 'thread with Accept, Counter and Decline');
record('P11', /Sample record/.test(readFileSync(join(ROOT, 'sandbox/page.js'), 'utf8')), 'sample record id and next step');
record('P12', pass('step-by-step') && /id="fund"/.test(readFileSync(join(ROOT, 'sandbox/index.html'), 'utf8')) && /id="release"/.test(readFileSync(join(ROOT, 'sandbox/index.html'), 'utf8')), 'separate step buttons');
record('P13', pass('fee-before-accept') && /not set yet/i.test(readFileSync(join(ROOT, 'assets/deal-machine.js'), 'utf8')), 'fee is not set');
record('P14', pass('dispute-refund'), 'test refund returns the hold');
record('P15', pass('sandbox-button') && pass('tap-targets-44'), 'button size');
record('P16', pass('plain-errors'), 'plain errors');
record('P17', pass('usdc-status'), 'registry badge');
record('P18', home.includes('How you get paid') && readFileSync(join(ROOT, 'docs/SELLER.html'), 'utf8').includes('id="how-you-get-paid"'), 'seller page linked from the nav');
record('P19', home.includes('Disputes') && /Who decides/.test(disputes) && (/Not set yet/.test(disputes) || /\d+\s+days/.test(disputes)), 'day counts or a clear not-set-yet state');
record('P20', /Copied/.test(readFileSync(join(ROOT, 'assets/site-controls.js'), 'utf8')) && /start-check/.test(readFileSync(join(ROOT, 'docs/START.html'), 'utf8')), 'Copied label and Check connection');
await browser.close();
const failed = results.filter((row) => !row.pass);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
