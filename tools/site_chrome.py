"""Shared header, journey, lifecycle diagram and footer for every public page."""
import hashlib
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME_START = '<!-- site-chrome:start -->'
CHROME_END = '<!-- site-chrome:end -->'
FOOTER_START = '<!-- site-footer:start -->'
FOOTER_END = '<!-- site-footer:end -->'
NAV_RE = re.compile(r'<nav\b[^>]*aria-label="Main"[^>]*>.*?</nav>', re.DOTALL)
MAIN_RE = re.compile(r'<main\b[^>]*>', re.IGNORECASE)

STEPS = [
    ('find', 'Find', 'docs/TERMINAL.html'),
    ('agree', 'Agree', 'docs/NEGOTIATION.html'),
    ('pay', 'Pay', 'docs/PAYING.html'),
    ('deliver', 'Deliver', 'docs/HOW_IT_WORKS.html#section_7'),
    ('resolve', 'Resolve', 'docs/PAYING.html#refunds'),
]
CURRENT = {
    'docs/TERMINAL.html': 'find',
    'docs/FIND.html': 'find',
    'docs/NEGOTIATION.html': 'agree',
    'docs/AGREE.html': 'agree',
    'docs/MATRIX.html': 'agree',
    'docs/START.html': 'agree',
    'docs/PAYING.html': 'pay',
    'docs/PAY.html': 'pay',
    'docs/PAYMENTS.html': 'pay',
    'docs/PRICING.html': 'pay',
    'docs/HOW_IT_WORKS.html': 'deliver',
    'docs/DELIVER.html': 'deliver',
    'docs/RESOLVE.html': 'resolve',
    'sandbox/index.html': 'resolve',
}
NEXT = {
    'find': ('Agree the terms', 'docs/NEGOTIATION.html'),
    'agree': ('See how paying works', 'docs/PAYING.html'),
    'pay': ('See delivery', 'docs/HOW_IT_WORKS.html#section_7'),
    'deliver': ('See disputes and refunds', 'docs/PAYING.html#refunds'),
    'resolve': ('Find a service', 'docs/TERMINAL.html'),
    None: ('Find a service', 'docs/TERMINAL.html'),
}


def href(page, target):
    return '../' * page.count('/') + target


def chrome(page):
    current = CURRENT.get(page)
    links = [
        ('I\'m a person', 'docs/PERSON.html'),
        ('Connect an agent', 'docs/AGENT.html'),
        ('Disputes & refunds', 'docs/DISPUTES.html'),
        ('How you get paid', 'docs/SELLER.html#how-you-get-paid'),
        *[(label, target) for _step, label, target in STEPS],
        ('Start', 'docs/START.html'),
        ('Buyer path', 'docs/BUYER.html'),
        ('Seller path', 'docs/SELLER.html'),
        ('Pricing', 'docs/PRICING.html'),
        ('About', 'docs/ABOUT.html'),
        ('Contact', 'docs/WORK_WITH_US.html'),
    ]
    items = ''.join('<a href="%s">%s</a>' % (html.escape(href(page, target), quote=True), html.escape(label, quote=False)) for label, target in links)
    steps = []
    for step, label, target in STEPS:
        current_attr = ' aria-current="step"' if step == current else ''
        steps.append('<li><a href="%s"%s>%s</a></li>' % (html.escape(href(page, target), quote=True), current_attr, html.escape(label, quote=False)))
    nxt_label, nxt_target = NEXT.get(current, NEXT[None])
    search = href(page, 'docs/TERMINAL.html')
    return '''%s
<form class="nav-search" role="search" action="%s" method="get"><label class="sr-only" for="site-search">Find a service</label><input id="site-search" name="q" type="search" placeholder="Find a service" autocomplete="off"><button type="submit" class="btn">Search</button></form>
<nav class="site-nav" aria-label="Main"><a class="nav-brand" href="%s">Covenant</a><input class="nav-toggle" type="checkbox" id="site-menu"><label class="nav-toggle-label" for="site-menu">Menu</label><div class="nav-links">%s</div></nav>
<nav class="journey" aria-label="Deal steps"><p>The deal, in order:</p><ol>%s</ol><p class="journey-next">Next: <a href="%s">%s</a></p></nav>
<details class="lifecycle"><summary>Stage names</summary><p>The same stages on every page.</p><ol><li>Find</li><li>Agree <span class="badge badge-off">PROPOSED</span></li><li>Pay <span class="badge badge-off">BOUND</span></li><li>Deliver <span class="badge badge-off">DELIVERED</span></li><li>Resolve <span class="badge badge-off">SETTLED</span> or <span class="badge badge-soon">DISPUTED</span> then <span class="badge badge-off">RELEASED</span></li></ol><p>Those stage names are the installed work-order checks. The public host cannot settle, hold or refund. A recorded <abbr class="term" title="A draft you swap by hand today. A recorded offer is coming soon.">offer</abbr> or <abbr class="term" title="A new draft that changes the price or the deadline. A recorded counter-offer is coming soon.">counter-offer</abbr> is coming soon. The browser sample uses test funds only.</p></details>
%s''' % (CHROME_START, html.escape(search, quote=True), html.escape(href(page, 'index.html'), quote=True), items, ''.join(steps), html.escape(href(page, nxt_target), quote=True), html.escape(nxt_label), CHROME_END)


def footer(page):
    links = [
        ('Terms', 'docs/TERMS.html'),
        ('Privacy', 'PRIVACY.html'),
        ('Contact', 'docs/WORK_WITH_US.html'),
        ('Is this binding?', 'docs/FAQ.html#is-this-legally-binding'),
    ]
    body = ''.join('<a href="%s">%s</a>' % (html.escape(href(page, target), quote=True), html.escape(label, quote=False)) for label, target in links)
    return '%s<footer class="site-footer" aria-label="Site"><p>%s</p></footer>%s' % (FOOTER_START, body, FOOTER_END)


def stylesheet(page):
    version = hashlib.sha256((ROOT / 'assets' / 'components.css').read_bytes()).hexdigest()[:16]
    return '<link rel="stylesheet" href="%s?v=%s">' % (html.escape(href(page, 'assets/components.css'), quote=True), version)


def strip_blocks(text):
    text = re.sub(re.escape(CHROME_START) + r'.*?' + re.escape(CHROME_END), '', text, count=1, flags=re.DOTALL)
    text = re.sub(re.escape(FOOTER_START) + r'.*?' + re.escape(FOOTER_END), '', text, count=1, flags=re.DOTALL)
    text = re.sub(r'\n?<link rel="stylesheet" href="(?:\.\./)*assets/components\.css(?:\?v=[0-9a-f]+)?">', '', text, count=1)
    return text


def apply(text, page):
    text = strip_blocks(text)
    text = NAV_RE.sub('', text, count=1)
    text = re.sub(r'(<main\b[^>]*>)\s*', r'\1', text, count=1)
    match = MAIN_RE.search(text)
    if not match:
        raise ValueError('No main element: ' + page)
    block = chrome(page)
    text = text[:match.end()] + block + text[match.end():]
    foot = footer(page)
    if '</main>' not in text:
        raise ValueError('No main close: ' + page)
    text = text.replace('</main>', foot + '</main>', 1)
    if 'assets/components.css' not in text:
        text = text.replace('</head>', stylesheet(page) + '</head>', 1)
    return text


def pages():
    found = [ROOT / 'index.html', ROOT / 'PRIVACY.html']
    found.extend(sorted((ROOT / 'docs').rglob('*.html')))
    found.extend(sorted((ROOT / 'sandbox').rglob('*.html')))
    return [path for path in found if path.is_file()]
