// Steps use the shared sample ledger. The signature check still loads Python.
import '../assets/deal-machine.js';
import { SandboxError, start } from './sandbox.js';

const { createSample, explain } = globalThis.CovenantDeal;
const base = new URL('./', document.baseURI);
const $ = (id) => document.getElementById(id);
const STAGES = {
  manifest: 'Reading the site manifest...',
  package: 'Downloading the package and checking its fingerprint...',
  python: (manifest) => `Still loading Python (${(manifest.download_bytes / 1e6).toFixed(1)} MB the first time)...`,
  ready: 'Running the signed sample...',
};
const NEXT_STEP = { ready: 'quote', quote: 'offer', offer: 'counter', counter: 'agree', agree: 'accept', bound: 'deliver' };
const NEXT_LABEL = {
  ready: 'Show the quote',
  quote: 'Send the buyer’s offer',
  offer: 'Send the seller’s counter',
  counter: 'Use 25 test USDC',
  agree: 'Accept and hold the test funds',
  bound: 'Mark the work delivered',
};
const CONFIRM = {
  accept: 'Accepting holds 25 test USDC in this page. It does not bind a real person and it does not pay a hosted bill.',
  release: 'Release pays the seller in test USDC. It does not move real money.',
  refund: 'Refund returns the held test USDC to the buyer. Hosted USDC cannot do this.',
};
let session = null;
let last = null;
let sample = createSample();
let pending = null;

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchBytes(url, limit) {
  const response = await fetch(url, { cache: 'no-cache', credentials: 'omit' });
  if (!response.ok) throw new SandboxError('SANDBOX_DOWNLOAD', `${url.pathname} ${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) throw new SandboxError('SANDBOX_PACKAGE_MISMATCH', `${url.pathname} too large`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new SandboxError('SANDBOX_PACKAGE_MISMATCH', `${url.pathname} too large`);
  return bytes;
}

const env = {
  base,
  fetchBytes,
  fetchText: async (url, limit) => new TextDecoder('utf-8', { fatal: true }).decode(await fetchBytes(url, limit)),
  sha256hex: async (bytes) => hex(await crypto.subtle.digest('SHA-256', bytes)),
  loadPyodide: async (options) => (await import(new URL('pyodide/pyodide.mjs', base).href)).loadPyodide(options),
  progress: (stage, manifest) => {
    const text = STAGES[stage];
    $('py-status').textContent = typeof text === 'function' ? text(manifest) : text || '';
  },
};

function line(parent, text) {
  const p = document.createElement('p');
  p.textContent = text;
  parent.append(p);
}

function show(result) {
  $('step-error').textContent = '';
  if (result.error) {
    $('step-error').textContent = explain(result.error) || result.error;
    return;
  }
  const item = document.createElement('li');
  item.textContent = result.said + ' ' + result.money + ' ' + result.feeText;
  $('step-log').append(item);
  $('money').replaceChildren();
  line($('money'), result.money);
  line($('money'), result.feeText);
  $('step-status').textContent = result.serverState + '. ' + result.said;
  const phase = sample.phase();
  $('next').hidden = phase === 'delivered' || phase === 'disputed' || phase === 'settled' || phase === 'released';
  $('next').textContent = NEXT_LABEL[phase] || 'Next';
  $('branch').hidden = phase !== 'delivered' && phase !== 'disputed';
  $('release').disabled = phase !== 'delivered';
  $('dispute').disabled = phase !== 'delivered';
  $('refund').disabled = phase !== 'disputed';
}

function ask(action) {
  pending = action;
  $('confirm-text').textContent = CONFIRM[action];
  $('confirm').hidden = false;
}

function act(name) {
  show(sample.step(name));
}

$('next').addEventListener('click', () => {
  const name = NEXT_STEP[sample.phase()];
  if (!name) return;
  if (CONFIRM[name]) ask(name);
  else act(name);
});
$('release').addEventListener('click', () => ask('release'));
$('dispute').addEventListener('click', () => act('dispute'));
$('refund').addEventListener('click', () => ask('refund'));
$('confirm-no').addEventListener('click', () => { pending = null; $('confirm').hidden = true; });
$('confirm-yes').addEventListener('click', () => {
  const name = pending;
  pending = null;
  $('confirm').hidden = true;
  if (name) act(name);
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SandboxError('SANDBOX_TIMEOUT')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function fail(error) {
  const known = error instanceof SandboxError ? error : new SandboxError('SANDBOX_DEMO_FAILED', error && error.message);
  const info = known.explain();
  const box = $('error');
  box.replaceChildren();
  line(box, (info.code in globalThis.CovenantDeal.MESSAGES ? explain(info.code) : info.what));
  line(box, info.fix);
  box.hidden = false;
  $('py-status').textContent = 'The signature check stopped. The steps above are unchanged. No real money moved.';
}

async function run() {
  $('run').disabled = true;
  $('error').hidden = true;
  try {
    if (!globalThis.isSecureContext || !globalThis.crypto || !crypto.subtle) throw new SandboxError('SANDBOX_INSECURE_PAGE');
    if (session === null) session = await withTimeout(start(env), 90000);
    $('py-status').textContent = STAGES.ready;
    last = session.demo();
    $('record').textContent = JSON.stringify(last.record, null, 2);
    $('py-status').textContent = 'Signed sample checked in this page. No real money moved and nothing was sent.';
    $('check').disabled = false;
    $('forge').disabled = false;
  } catch (error) {
    fail(error);
  } finally {
    $('run').disabled = false;
  }
}

function check(tamper) {
  try {
    const report = session.check(last.record, tamper);
    const out = $('checked');
    out.replaceChildren();
    const original = last.record.terms.quantity;
    line(out, tamper
      ? `The price was changed from ${original} to ${original * 100} test USDC. The check refused it.`
      : 'The signed record checks out.');
    for (const problem of report.problems) line(out, (problem.code in globalThis.CovenantDeal.MESSAGES ? explain(problem.code) : (problem.fix || 'The check refused the record.')));
    line(out, 'Signatures were checked in this page. Escrow here is test money.');
  } catch (error) {
    fail(error);
  }
}

$('run').addEventListener('click', run);
$('check').addEventListener('click', () => check(false));
$('forge').addEventListener('click', () => check(true));
