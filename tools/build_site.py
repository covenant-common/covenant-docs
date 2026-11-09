#!/usr/bin/env python3
"""Apply the shared chrome and keep generated status text tied to the registry."""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fee_copy import fee_sentence
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


FUNDS_SENTENCE = (
    'Covenant never holds your money. In test mode, the test rail holds it; '
    'for real payments, the payment provider or an escrow contract will.'
)
FUNDS_PAGES = (
    'index.html',
    'docs/PAY.html',
    'docs/PAYING.html',
    'docs/PAYMENTS.html',
    'docs/APPROVALS.html',
    'docs/TRUST_AND_LEGAL.html',
)


FEE_NOT_SET = fee_sentence(REGISTRY)


def funds_text():
    return (
        FUNDS_SENTENCE + '\n'
        'The seller is who you are buying from. Covenant provides the platform. '
        'The seller is the merchant of record. ' + FEE_NOT_SET
    )


def funds_html():
    return (
        '<div class="callout" id="never-holds"><p>%s</p>'
        '<p>The seller is who you are buying from. Covenant provides the platform. '
        'The seller is the merchant of record.</p>'
        '<p><!-- TODO(owner): the fee amount -->%s</p></div>'
    ) % (FUNDS_SENTENCE, FEE_NOT_SET)


def badge_todos(text):
    text = re.sub(
        r'<span class="owner-pending"><span class="todo-marker"[^>]*>(.*?)</span><span class="todo-label">.*?</span></span>',
        lambda match: '<!-- %s --><span class="owner-pending">Not set yet. The owner will confirm this</span>' % match.group(1),
        text,
    )

    def wrap(match):
        return '<!-- %s --><span class="owner-pending">Not set yet. The owner will confirm this</span>' % match.group(0)

    parts = re.split(r'(<[^>]+>)', text)
    out = []
    marker = 0
    for part in parts:
        if part.startswith('<'):
            if part.startswith('<span class="todo-marker"'):
                marker += 1
            elif part.startswith('</span>') and marker:
                marker -= 1
            out.append(part)
            continue
        if marker:
            out.append(part)
            continue
        part = re.sub(r'TODO\(owner, legal\)', wrap, part)
        part = re.sub(r'TODO\(owner\)', wrap, part)
        part = re.sub(r'Owner TODO', wrap, part)
        out.append(part)
    return ''.join(out)


def standards_table():
    from registry_view import apply_works_in_test
    rows = []
    standards = apply_works_in_test(REGISTRY.get('standards', []), (REGISTRY.get('sandbox') or {}).get('works_in_test'), REGISTRY)
    for row in standards:
        note = (' ' + row['date_note']) if row.get('date_note') else ''
        when = row['source_date']
        cells = (
            ('Standard', row['name']),
            ('What it is', row['what']),
            ('Covenant status', row['status']),
            ('Where', row['where']),
        )
        body = ''.join('<td data-label="%s">%s</td>' % (html.escape(label, quote=True), html.escape(value)) for label, value in cells)
        body += '<td data-label="Source and date"><a href="%s">Source</a> (<time datetime="%s">%s</time>%s)</td>' % (
            html.escape(row['source'], quote=True),
            html.escape(when, quote=True),
            html.escape(when),
            html.escape(note),
        )
        rows.append('<tr>' + body + '</tr>')
    return '\n'.join(rows)


def payment_rows():
    badges = REGISTRY['badges']
    rows = []
    for row in REGISTRY['payments']:
        rows.append('<tr data-method="%s"><td>%s</td><td>%s</td><td>%s</td></tr>' % (html.escape(row['id'], quote=True), row['label'], badges[row['badge']], row['plain']))
    return '<!-- registry-payments:start -->\n' + '\n'.join(rows) + '\n<!-- registry-payments:end -->'


def payment_labels_line():
    badges = REGISTRY['badges']
    pairs = ', '.join("%s:'%s'" % (key, badges[key].replace("'", "\\'")) for key in
                      ('NOT_CONNECTED', 'CONFIGURED_UNVERIFIED', 'TEST_ONLY', 'NOT_LIVE', 'COMING_SOON', 'LIVE'))
    return '  const LABELS = {%s};' % pairs


def sync_payment_labels(text):
    return re.sub(r'  const LABELS = \{.*?\};', payment_labels_line(), text, count=1, flags=re.DOTALL)


def unwrap_term_abbr(text):
    inner = re.compile(r'<abbr class="term" title="[^"]*">([^<]*)</abbr>', re.I)
    while True:
        updated = inner.sub(r'\1', text)
        if updated == text:
            return text
        text = updated


def wrap_tooltips(text):
    text = unwrap_term_abbr(text)
    terms = sorted(TOOLTIPS, key=len, reverse=True)
    if not terms:
        return text
    pattern = re.compile(r'\b(?:' + '|'.join(re.escape(term) for term in terms) + r')\b', re.I)
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
                if name in SKIP_TAGS or name in ('nav', 'figure', 'svg', 'desc'):
                    stack.append(name)
            out.append(part)
            continue
        if stack:
            out.append(part)
            continue

        def repl(match):
            word = match.group(0)
            key = next(term for term in terms if term.lower() == word.lower())
            if key.lower() in seen:
                return word
            seen.add(key.lower())
            title = (TOOLTIPS[key].replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;'))
            return '<abbr class="term" title="%s">%s</abbr>' % (title, word)

        out.append(pattern.sub(repl, part))
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


def fill_registry_markers(text):
    from registry_view import registry_list_sentence, sandbox_http_sentence
    note = sandbox_http_sentence(REGISTRY)

    def lists(match):
        names = match.group(1).split()
        body = registry_list_sentence(REGISTRY, names)
        return '<!-- registry-lists:start %s -->%s<!-- registry-lists:end -->' % (match.group(1), body)

    text = re.sub(r'<!-- registry-lists:start ([^>]*?) -->.*?<!-- registry-lists:end -->', lists, text, flags=re.S)
    text = re.sub(
        r'<!-- sandbox-http:start -->.*?<!-- sandbox-http:end -->',
        '<!-- sandbox-http:start -->%s<!-- sandbox-http:end -->' % note,
        text,
        flags=re.S,
    )
    text = re.sub(r'\[sandbox-http\].*?\[/sandbox-http\]', '[sandbox-http]\n%s\n[/sandbox-http]' % note, text, flags=re.S)
    return text


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
    if '<!-- funds-decision:start -->' in text:
        updated = marked(text, '<!-- funds-decision:start -->', '<!-- funds-decision:end -->', funds_html())
        if updated is not None:
            text = updated
    if rel == 'docs/AGENTIC_COMMERCE.html':
        updated = marked(text, '<!-- standards-matrix:start -->', '<!-- standards-matrix:end -->', standards_table())
        if updated is not None:
            text = updated
    if rel == 'docs/GLOSSARY.html':
        updated = marked(text, '<!-- glossary-body:start -->', '<!-- glossary-body:end -->', glossary_body().split('\n', 1)[1].rsplit('\n', 1)[0])
        if updated is None and '<h2 id="access-file">' in text:
            text = re.sub(r'<h2 id="access-file">.*?(?=<!-- site-footer:start -->|</main>)', glossary_body() + '\n', text, count=1, flags=re.DOTALL)
        elif updated is not None:
            text = updated
    if not rel.startswith('docs/technical/'):
        text = badge_todos(text)
    text = apply(text, rel)
    if not rel.startswith('docs/technical/'):
        text = wrap_tooltips(text)
    return fill_registry_markers(text)


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
    for path in [ROOT / 'llms.txt', ROOT / 'docs' / 'API_MCP.html']:
        if not path.is_file():
            continue
        text = path.read_text()
        start, end = ('[registry-tools]', '[/registry-tools]') if path.suffix == '.txt' else ('<!-- registry-tools:start -->', '<!-- registry-tools:end -->')
        updated = marked(text, start, end, tools_sentence())
        if updated is not None and updated != text:
            changed.append(path.relative_to(ROOT).as_posix())
            if not check:
                path.write_text(updated)
    llms = ROOT / 'llms.txt'
    filled = fill_registry_markers(llms.read_text())
    if filled != llms.read_text():
        changed.append('llms.txt')
        if not check:
            llms.write_text(filled)
    llms_text = llms.read_text()
    sentence = '[registry-tools]\n' + tools_sentence() + '\n[/registry-tools]'
    updated = marked(llms_text, '[registry-tools]', '[/registry-tools]', tools_sentence())
    if updated is None:
        updated = llms_text.replace(
            'The public tools are `aap_public_listing_search`, `covenant_marketplace__quick_trade`, `covenant_contract__draft`, `covenant_contract__inspect`, `covenant_contract__compare`, `covenant_contract__render`, `covenant_review__review`, `covenant_review__authority` and `covenant_review__evidence`. Names from an installed private SDK are not tools on this public server.',
            sentence, 1)
    if updated != llms_text:
        changed.append('llms.txt')
        if not check:
            llms.write_text(updated)
        llms_text = updated if not check else llms_text
    if check:
        llms_text = llms.read_text()
    funds_updated = marked(llms_text, '[funds-decision]', '[/funds-decision]', funds_text())
    if funds_updated is not None and funds_updated != llms.read_text():
        changed.append('llms.txt')
        if not check:
            llms.write_text(funds_updated)
    if not check:
        ensure_sitemap([path.relative_to(ROOT).as_posix() for path in html_paths
                        if 'technical' not in path.parts and not path.as_posix().startswith(str(ROOT / 'sandbox'))])
        import subprocess
        subprocess.check_call([sys.executable, str(ROOT / 'tools' / 'check_public_site.py'), '--write-manifest'])
    print({'status': 'FAIL' if check and changed else 'PASS', 'changed': changed})
    return 1 if check and changed else 0


if __name__ == '__main__':
    raise SystemExit(main())
