#!/usr/bin/env python3
"""Apply the shared chrome and keep generated status text tied to the registry."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from site_chrome import ROOT, apply, pages

REGISTRY = json.loads((ROOT / 'distribution' / 'capability-registry.json').read_text())
TOOLTIPS = {
    'counter-offer': 'A new draft that changes the price or the deadline. A recorded counter-offer is coming soon.',
    'fee_opt_in': 'The payer’s choice to add the posted fee. It defaults to off.',
    'bearer token': 'The account credential. It is not a signature and it does not pay.',
    'USDC_MICRO': 'Six-decimal token units. 25 USDC = 25,000,000 micro-units. Not a dollar conversion.',
    'Ed25519': 'The signature type used by the account tools.',
    'supersedes': 'A link to the previous draft. A public draft refuses it.',
    'eip155': 'A network id in the payment catalogue. Naming it does not move money.',
    'escrow': 'The browser sample can hold test funds. Hosted USDC does not. That payment is final.',
    'resolver': 'A third party in the browser sample. Hosted USDC does not require one.',
    'offer': 'A draft you swap by hand today. A recorded offer is coming soon.',
    'MCP': 'The public tool connection. It can draft. It cannot sign, publish, pay or refund.',
    'AAP': 'The engine name under Covenant. The native payment network is not live.',
}
SKIP_TAGS = {'script', 'style', 'code', 'pre', 'abbr', 'textarea'}
SITEMAP = ROOT / 'sitemap.xml'
BASE = 'https://covenant-common.github.io/covenant-docs/'


def payment_labels_line():
    badges = REGISTRY['badges']
    pairs = ', '.join("%s:'%s'" % (key, badges[key].replace("'", "\\'")) for key in
                      ('NOT_CONNECTED', 'CONFIGURED_UNVERIFIED', 'TEST_ONLY', 'NOT_LIVE', 'COMING_SOON', 'LIVE'))
    return '  const LABELS = {%s};' % pairs


def sync_payment_labels(text):
    return re.sub(r'  const LABELS = \{.*?\};', payment_labels_line(), text, count=1, flags=re.DOTALL)


def wrap_tooltips(text):
    pending = {term: title for term, title in TOOLTIPS.items()
               if not re.search(r'<abbr class="term"[^>]*>' + re.escape(term) + r'</abbr>', text, re.I)}
    if not pending:
        return text
    parts = re.split(r'(<[^>]+>)', text)
    stack = []
    seen = set()
    out = []
    for part in parts:
        if part.startswith('<'):
            close = re.match(r'</\s*([A-Za-z0-9]+)', part)
            start = re.match(r'<\s*([A-Za-z0-9]+)', part)
            if close:
                name = close.group(1).lower()
                if stack and stack[-1] == name:
                    stack.pop()
            elif start and not part.endswith('/>') and not part.startswith('<!'):
                name = start.group(1).lower()
                if name in SKIP_TAGS or name in ('nav', 'figure'):
                    stack.append(name)
            out.append(part)
            continue
        if stack:
            out.append(part)
            continue
        def repl(match):
            word = match.group(0)
            key = next((term for term in pending if term.lower() == word.lower()), None)
            if key is None:
                return word
            if key in seen:
                return word
            seen.add(key)
            title = TOOLTIPS[key].replace('&', '&amp;').replace('"', '&quot;')
            return '<abbr class="term" title="%s">%s</abbr>' % (title, word)
        for term in TOOLTIPS:
            part = re.sub(r'\b' + re.escape(term) + r'\b', repl, part, count=1, flags=re.I)
        out.append(part)
    return ''.join(out)


def ensure_sitemap(names):
    text = SITEMAP.read_text()
    missing = []
    for name in names:
        loc = BASE if name == 'index.html' else BASE + name
        if loc not in text:
            missing.append('  <url><loc>%s</loc></url>\n' % loc)
    if missing:
        text = text.replace('</urlset>', ''.join(missing) + '</urlset>')
        SITEMAP.write_text(text)
    return missing


def transform(path):
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text()
    if rel == 'docs/PAYING.html' and 'id="refunds"' not in text:
        text = text.replace('<h2>Refunds and disputes today</h2>', '<h2 id="refunds">Refunds and disputes today</h2>', 1)
    text = apply(text, rel)
    if not rel.startswith('docs/technical/'):
        text = wrap_tooltips(text)
    return text


def main():
    check = '--check' in sys.argv
    changed = []
    html_paths = pages()
    for path in html_paths:
        new = transform(path)
        if path.read_text() != new:
            changed.append(path.relative_to(ROOT).as_posix())
            if not check:
                path.write_text(new)
    labels = ROOT / 'assets' / 'payment-options.js'
    new_labels = sync_payment_labels(labels.read_text())
    if labels.read_text() != new_labels:
        changed.append('assets/payment-options.js')
        if not check:
            labels.write_text(new_labels)
    if not check:
        ensure_sitemap([path.relative_to(ROOT).as_posix() for path in html_paths
                        if 'technical' not in path.parts and not path.as_posix().startswith(str(ROOT / 'sandbox'))])
    print({'status': 'FAIL' if check and changed else 'PASS', 'changed': changed})
    return 1 if check and changed else 0


if __name__ == '__main__':
    raise SystemExit(main())
