#!/usr/bin/env python3
"""Apply the shared chrome and keep generated status text tied to the registry."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from site_chrome import ROOT, apply, pages

REGISTRY = json.loads((ROOT / 'distribution' / 'capability-registry.json').read_text())
GLOSSARY = json.loads((ROOT / 'distribution' / 'glossary.json').read_text())
TOOLTIPS = {entry['term']: entry['tooltip'] for entry in GLOSSARY['entries'] if entry.get('tooltip')}
SKIP_TAGS = {'script', 'style', 'code', 'pre', 'abbr', 'textarea'}
SITEMAP = ROOT / 'sitemap.xml'
BASE = 'https://covenant-common.github.io/covenant-docs/'


def marked(text, start, end, body):
    block = start + '\n' + body.strip() + '\n' + end
    pattern = re.escape(start) + r'.*?' + re.escape(end)
    if start in text and end in text:
        return re.sub(pattern, lambda _match: block, text, count=1, flags=re.DOTALL)
    return None


def glossary_body():
    parts = ['<!-- glossary-body:start -->']
    for entry in GLOSSARY['entries']:
        parts.append('<h2 id="%s">%s</h2>' % (entry['id'], entry['term']))
        parts.append('<p>%s</p>' % entry['body'])
    parts.append('<!-- glossary-body:end -->')
    return '\n'.join(parts)


def tools_sentence():
    names = REGISTRY['public_tools']
    quoted = ', '.join('`%s`' % name for name in names[:-1]) + ' and `%s`' % names[-1]
    return 'The %d public tools are %s. Names from an installed private SDK are not tools on this public server.' % (len(names), quoted)


def payment_rows():
    badges = REGISTRY['badges']
    rows = []
    for row in REGISTRY['payments']:
        rows.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (row['label'], badges[row['badge']], row['plain']))
    return '<!-- registry-payments:start -->\n' + '\n'.join(rows) + '\n<!-- registry-payments:end -->'


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
    if rel == 'docs/PAYING.html':
        updated = marked(text, '<!-- registry-payments:start -->', '<!-- registry-payments:end -->', payment_rows().split('\n', 1)[1].rsplit('\n', 1)[0])
        if updated is None:
            text = re.sub(r'<tbody>.*?</tbody>', '<tbody>\n' + payment_rows() + '\n</tbody>', text, count=1, flags=re.DOTALL)
        else:
            text = updated
    if rel == 'docs/GLOSSARY.html':
        updated = marked(text, '<!-- glossary-body:start -->', '<!-- glossary-body:end -->', glossary_body().split('\n', 1)[1].rsplit('\n', 1)[0])
        if updated is None and '<h2 id="access-file">' in text:
            text = re.sub(r'<h2 id="access-file">.*?(?=<!-- site-footer:start -->|</main>)', glossary_body() + '\n', text, count=1, flags=re.DOTALL)
        elif updated is not None:
            text = updated
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
    llms = ROOT / 'llms.txt'
    llms_text = llms.read_text()
    sentence = '<!-- registry-tools:start -->\n' + tools_sentence() + '\n<!-- registry-tools:end -->'
    updated = marked(llms_text, '<!-- registry-tools:start -->', '<!-- registry-tools:end -->', tools_sentence())
    if updated is None:
        updated = llms_text.replace(
            'The nine public tools are `aap_public_listing_search`, `covenant_marketplace__quick_trade`, `covenant_contract__draft`, `covenant_contract__inspect`, `covenant_contract__compare`, `covenant_contract__render`, `covenant_review__review`, `covenant_review__authority` and `covenant_review__evidence`. Names from an installed private SDK are not tools on this public server.',
            sentence, 1)
    if updated != llms_text:
        changed.append('llms.txt')
        if not check:
            llms.write_text(updated)
    if not check:
        ensure_sitemap([path.relative_to(ROOT).as_posix() for path in html_paths
                        if 'technical' not in path.parts and not path.as_posix().startswith(str(ROOT / 'sandbox'))])
    print({'status': 'FAIL' if check and changed else 'PASS', 'changed': changed})
    return 1 if check and changed else 0


if __name__ == '__main__':
    raise SystemExit(main())
