// The sandbox page: wires sandbox.js to the document. Every value is set as text (textContent).
import { SandboxError, start } from './sandbox.js';

const base = new URL('./', document.baseURI);
const $ = (id) => document.getElementById(id);
const STAGES = {
  manifest: 'Reading the site manifest...',
  package: 'Downloading the package and checking its fingerprint...',
  python: (manifest) => `Loading Python into this page (${(manifest.download_bytes / 1e6).toFixed(1)} MB in all, the first time)...`,
  ready: 'Running the test deal...',
};
let session = null;
let last = null;

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
    $('status').textContent = typeof text === 'function' ? text(manifest) : text || '';
  },
};

function line(parent, text) {
  const p = document.createElement('p');
  p.textContent = text;
  parent.append(p);
}

function money(balances) {
  return `buyer ${balances.buyer}, seller ${balances.seller}, held in escrow ${balances.escrow} (test USDC)`;
}

function render(result) {
  for (const step of result.steps) {
    const out = $(`out-${step.step}`);
    out.replaceChildren();
    line(out, step.said);
    line(out, `Result: ${step.verdict}. Signed by: ${step.signed_by.join(' and ')}. Balances: ${money(step.balances)}.`);
    if (step.proof) line(out, `Proof: SHA-256 ${step.proof.content_sha256} over ${step.proof.content_bytes} bytes, signed by the ${step.proof.signed_by}.`);
    line(out, `Record ID after this step: ${step.record_id}`);
  }
  $('record').textContent = JSON.stringify(result.record, null, 2);
  $('summary').textContent = `Done in ${result.elapsed_ms} ms. Mode: ${result.mode}. Real value moved: no. Network used: no. Keys kept: no.`;
}

function fail(error) {
  const known = error instanceof SandboxError ? error : new SandboxError('SANDBOX_DEMO_FAILED', error && error.message);
  const info = known.explain();
  const box = $('error');
  box.replaceChildren();
  line(box, `${info.code}: ${info.what}`);
  line(box, `What to do: ${info.fix} Retrying ${info.retry ? 'can help' : 'will not help'}.`);
  if (info.detail) line(box, `Detail: ${info.detail}`);
  const link = document.createElement('a');
  link.href = info.reference;
  link.textContent = 'What this code means';
  box.append(link);
  box.hidden = false;
  $('status').textContent = 'Stopped.';
}

async function run() {
  $('run').disabled = true;
  $('error').hidden = true;
  try {
    if (!globalThis.isSecureContext || !globalThis.crypto || !crypto.subtle) throw new SandboxError('SANDBOX_INSECURE_PAGE');
    if (session === null) {
      session = await start(env);
      $('code').textContent = session.code;
    }
    $('status').textContent = STAGES.ready;
    last = session.demo();
    render(last);
    $('status').textContent = 'Done. Run it again for a fresh deal with new keys.';
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
    line(out, tamper
      ? `After changing the price to ${last.record.terms.quantity * 100}: ${report.verdict}.`
      : `The record checks out: ${report.verdict}.`);
    for (const problem of report.problems) line(out, `${problem.code}: ${problem.fix}`);
    line(out, report.note);
  } catch (error) {
    fail(error);
  }
}

$('run').addEventListener('click', run);
$('check').addEventListener('click', () => check(false));
$('forge').addEventListener('click', () => check(true));
