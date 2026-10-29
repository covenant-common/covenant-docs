// Agentic Agreements Protocol (AAP) browser sandbox: the DOM-free core.
// A deal is a promise both sides sign. Proof shows it was kept. If it wasn't,
// there is a fair way to fix it.
//
// page.js runs this in a browser; tools/check_sandbox.mjs runs the same steps
// under Node. It checks the package and golden_path.py against the fingerprints
// in sandbox.json, loads Python (Pyodide) from this site, installs the package
// into the in-page Python and runs the test deal. It sends nothing.

export const SENTENCE = "A deal is a promise both sides sign. Proof shows it was kept. If it wasn't, there is a fair way to fix it.";
export const MANIFEST_FORMAT = 'aap-sandbox-site/0.1';
export const REFERENCE = '../docs/INSTALL.html#sandbox-errors';
export const LIMITS = { manifest: 16384, wheel: 32 * 1024 * 1024, script: 65536, record: 65536 };
const WHEEL = /^agentic_agreements-[0-9][0-9A-Za-z.!+]*-py3-none-any\.whl$/;
const HEX64 = /^[0-9a-f]{64}$/;
const PACKAGE = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

export const ERRORS = {
  SANDBOX_INSECURE_PAGE: {
    what: 'The page was opened without HTTPS, so the browser cannot check fingerprints.',
    fix: 'Open it over https:// or from http://localhost.', retry: false },
  SANDBOX_MANIFEST: {
    what: 'The page could not read sandbox.json, which names the package to run.',
    fix: 'Serve the site that tools/build_sandbox.py built, not the source folder.', retry: false },
  SANDBOX_DOWNLOAD: {
    what: 'A file this page needs could not be downloaded.',
    fix: 'Check the connection and reload. The page loads files only from its own site.', retry: true },
  SANDBOX_PYTHON_LOAD: {
    what: 'Python (Pyodide) did not start in this browser.',
    fix: 'Use a current browser with WebAssembly turned on, then reload the page.', retry: true },
  SANDBOX_PACKAGE_MISMATCH: {
    what: 'A downloaded file does not match the fingerprint this page expects.',
    fix: 'Rebuild the site so the page and its files match. Never run code you cannot check.', retry: false },
  SANDBOX_DEMO_FAILED: {
    what: 'A step of the test deal failed.',
    fix: 'Run the demo again. If it fails twice, report the code and the detail shown.', retry: true },
};

export class SandboxError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code in ERRORS ? code : 'SANDBOX_DEMO_FAILED';
    this.detail = detail == null ? null : String(detail).slice(0, 500);
  }

  explain() {
    return { code: this.code, ...ERRORS[this.code], detail: this.detail, reference: REFERENCE };
  }
}

function need(ok, code, detail) {
  if (!ok) throw new SandboxError(code, detail);
}

export function readManifest(text) {
  need(typeof text === 'string' && text.length <= LIMITS.manifest, 'SANDBOX_MANIFEST', 'size');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new SandboxError('SANDBOX_MANIFEST', 'json');
  }
  need(doc !== null && typeof doc === 'object' && doc.format === MANIFEST_FORMAT, 'SANDBOX_MANIFEST', 'format');
  const { wheel, script, pyodide } = doc;
  need(wheel && WHEEL.test(wheel.file) && HEX64.test(wheel.sha256) && Number.isInteger(wheel.bytes)
       && wheel.bytes > 0 && wheel.bytes <= LIMITS.wheel, 'SANDBOX_MANIFEST', 'wheel');
  need(script && script.file === 'golden_path.py' && HEX64.test(script.sha256), 'SANDBOX_MANIFEST', 'script');
  need(Number.isInteger(doc.download_bytes) && doc.download_bytes > 0 && doc.download_bytes <= 4 * LIMITS.wheel,
       'SANDBOX_MANIFEST', 'download_bytes');
  need(pyodide && pyodide.path === 'pyodide/' && typeof pyodide.version === 'string'
       && Array.isArray(pyodide.packages) && pyodide.packages.length >= 1 && pyodide.packages.length <= 8
       && pyodide.packages.every((name) => typeof name === 'string' && PACKAGE.test(name)), 'SANDBOX_MANIFEST', 'pyodide');
  return doc;
}

async function checked(env, file, sha256, limit) {
  let bytes;
  try {
    bytes = await env.fetchBytes(new URL(file, env.base), limit);
  } catch (error) {
    throw error instanceof SandboxError ? error : new SandboxError('SANDBOX_DOWNLOAD', `${file}: ${error && error.message}`);
  }
  need(bytes instanceof Uint8Array && bytes.byteLength <= limit, 'SANDBOX_PACKAGE_MISMATCH', file);
  need((await env.sha256hex(bytes)) === sha256, 'SANDBOX_PACKAGE_MISMATCH', file);
  return bytes;
}

// env: {base, loadPyodide, fetchBytes(url, limit), fetchText(url, limit), sha256hex(bytes), progress(stage)}
export async function start(env) {
  const progress = env.progress || (() => {});
  progress('manifest');
  let manifest;
  try {
    manifest = readManifest(await env.fetchText(new URL('sandbox.json', env.base), LIMITS.manifest));
  } catch (error) {
    if (error instanceof SandboxError && error.code === 'SANDBOX_MANIFEST') throw error;
    throw new SandboxError('SANDBOX_MANIFEST', error && (error.detail || error.message));
  }
  progress('package', manifest);
  const wheel = await checked(env, manifest.wheel.file, manifest.wheel.sha256, LIMITS.wheel);
  need(wheel.byteLength === manifest.wheel.bytes, 'SANDBOX_PACKAGE_MISMATCH', manifest.wheel.file);
  const script = await checked(env, manifest.script.file, manifest.script.sha256, LIMITS.script);
  const code = new TextDecoder('utf-8', { fatal: true }).decode(script);
  progress('python', manifest);
  let pyodide;
  try {
    pyodide = await env.loadPyodide({ indexURL: new URL(manifest.pyodide.path, env.base).href });
    await pyodide.loadPackage(manifest.pyodide.packages, { checkIntegrity: true, messageCallback: () => {} });
  } catch (error) {
    throw new SandboxError('SANDBOX_PYTHON_LOAD', error && error.message);
  }
  let module;
  try {
    pyodide.unpackArchive(wheel, 'wheel');
    pyodide.FS.mkdirTree('/aap-sandbox');
    pyodide.FS.writeFile('/aap-sandbox/golden_path.py', code);
    pyodide.runPython("import sys\nsys.path.insert(0, '/aap-sandbox')\nimport golden_path");
    module = pyodide.pyimport('golden_path');
  } catch (error) {
    throw new SandboxError('SANDBOX_DEMO_FAILED', error && error.message);
  }
  const call = (run) => {
    try {
      return JSON.parse(run());
    } catch (error) {
      throw new SandboxError('SANDBOX_DEMO_FAILED', error && error.message);
    }
  };
  progress('ready', manifest);
  return {
    manifest,
    code,
    demo: () => call(() => module.demo_json()),
    check: (record, tamper = false) => {
      const raw = JSON.stringify(record);
      need(typeof raw === 'string' && raw.length <= LIMITS.record, 'SANDBOX_DEMO_FAILED', 'record size');
      return call(() => module.check_json(raw, Boolean(tamper)));
    },
  };
}
