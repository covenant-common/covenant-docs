#!/usr/bin/env python3
"""Check site links, anchors, stylesheet policy and private-repository URLs.

Local files, directory index links, JavaScript string links, bare URLs in
text files, and same-site fragments are errors when they are wrong. HTTP
fetches run unless --offline is set. A timeout, disconnect, TLS error, or
third-party HTTP 404 is a warning, so it cannot fail CI. The private
repository URL and the API host's unactivated catalog and server-card paths
still fail the run.
"""
import argparse
import json
import re
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'pyodide', 'node_modules'}
PRIVATE_REPO = re.compile(r'https://github\.com/covenant-common/covenant(?=/)')
# The public docs name this open server change. Other covenant-repo URLs stay blocked.
ALLOWED_SERVER_PRS = (
    'https://github.com/covenant-common/covenant/pull/192',
    'https://github.com/covenant-common/covenant/pull/200',
    'https://github.com/covenant-common/covenant/pull/201',
)
UNACTIVATED = (
    'jupie202020.pythonanywhere.com/mcp/server-card',
    'jupie202020.pythonanywhere.com/.well-known/api-catalog',
)
MCP_POST = 'https://jupie202020.pythonanywhere.com/mcp'
JS_HTTP = re.compile(r'''['"](https?://[^'"\\\s]+)['"]''')
JS_REL = re.compile(r'''['"]((?:\.\./|\./)[^'"\\\s]+)['"]''')
BARE_URL = re.compile(r'https?://[^\s<>\]\)"\'`]+')
FRAGMENT_ATTR = re.compile(r'''(?:id|name)\s*=\s*['"]([^'"]+)['"]''')


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()
        self.csp = None
        self.nav_labels = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(unquote(a['id']))
        if tag == 'a' and a.get('name'):
            self.ids.add(unquote(a['name']))
        if tag == 'nav':
            self.nav_labels.append((a.get('aria-label') or '').strip())
        if tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy':
            self.csp = a.get('content', '')
        if tag in ('a', 'link', 'img', 'script', 'source', 'iframe', 'video', 'audio'):
            url = a.get('href', a.get('src'))
            if url:
                self.links.append((tag, a.get('rel', ''), url))
        if tag == 'img' and a.get('srcset'):
            for part in a['srcset'].split(','):
                url = part.strip().split(' ')[0]
                if url:
                    self.links.append(('img', '', url))


def pages():
    found = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or SKIP.intersection(path.parts) or path.stat().st_size > 250_000:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if path.suffix.lower() in {'.html', '.md', '.txt', '.js', '.mjs'} or rel in {
                '.well-known/api-catalog', '.well-known/api-catalog.json'}:
            found.append(path)
    return found


def markdown_links(text):
    links = []
    for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)', text):
        raw = match.group(1).strip()
        if raw.startswith('<') and '>' in raw:
            raw = raw[1:raw.index('>')]
        links.append(raw.split()[0].strip('<>'))
    return links


def bare_urls(text):
        return [match.group(0).rstrip('.,;:`') for match in BARE_URL.finditer(text)]


def js_links(text):
    found = []
    found.extend(match.group(1) for match in JS_HTTP.finditer(text))
    for match in JS_REL.finditer(text):
        url = match.group(1)
        if url.endswith('/') or re.search(r'\.(?:html|css|js|mjs|json|md|txt|svg|png|ico)(?:$|[?#])', url):
            found.append(url)
    return found


def linkset_urls(value):
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ('href', 'anchor') and isinstance(item, str):
                found.append(item)
            else:
                found.extend(linkset_urls(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(linkset_urls(item))
    return found


def csp_directives(csp):
    parsed = {}
    for part in (csp or '').split(';'):
        bits = part.strip().split()
        if bits:
            parsed[bits[0].lower()] = bits[1:]
    return parsed


def element_sources(csp, kind):
    """Return the source list that governs kind, or None when CSP does not restrict it."""
    if not csp:
        return None
    parsed = csp_directives(csp)
    keys = {
        'style': ('style-src-elem', 'style-src', 'default-src'),
        'script': ('script-src-elem', 'script-src', 'default-src'),
        'image': ('img-src', 'default-src'),
    }[kind]
    for key in keys:
        if key in parsed:
            return parsed[key]
    return None


def allows_self(sources):
    """True when a same-origin file is allowed. Scheme sources such as data: are not 'self'."""
    if sources is None:
        return True
    return any(item in ("'self'", '*') for item in sources)


def own_site(url):
    """Map a published docs URL back to a path in this repository, when it is one."""
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or parsed.netloc != 'covenant-common.github.io':
        return None
    prefix = '/covenant-docs'
    if parsed.path != prefix and not parsed.path.startswith(prefix + '/'):
        return None
    rel = unquote(parsed.path[len(prefix):].lstrip('/'))
    if rel in ('',):
        rel = 'index.html'
    target = (ROOT / rel).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return 'outside'
    return target


def local_target(page, url):
    parsed = urlsplit(url)
    if parsed.scheme in ('mailto', 'javascript', 'data') or parsed.netloc:
        return None
    if not parsed.path:
        return page if parsed.fragment else None
    target = (page.parent / unquote(parsed.path)).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return 'outside'
    return target


def as_file(target):
    """Follow a directory link to its index page."""
    if not isinstance(target, Path):
        return target
    if target.is_file():
        return target
    index = target / 'index.html'
    if target.is_dir() and index.is_file():
        return index
    return target


def record(rel, url, page, pending, external, errors):
    parsed = urlsplit(url)
    if not url or parsed.scheme in ('mailto', 'javascript', 'data'):
        return
    if parsed.scheme in ('http', 'https'):
        owned = as_file(own_site(url))
        if owned == 'outside' or (isinstance(owned, Path) and not owned.is_file()):
            errors.append('Missing local link: ' + rel + ' -> ' + url)
        elif isinstance(owned, Path) and parsed.fragment and owned.suffix.lower() == '.html':
            pending.append((rel, url, owned.relative_to(ROOT).as_posix(), unquote(parsed.fragment)))
        elif owned is None:
            base = url.split('#', 1)[0]
            slot = external.setdefault(base, {'where': [], 'fragments': []})
            slot['where'].append(rel + ' -> ' + url)
            if parsed.fragment and unquote(parsed.fragment) not in slot['fragments']:
                slot['fragments'].append(unquote(parsed.fragment))
        return
    if not parsed.path and not parsed.fragment:
        return
    target = as_file(local_target(page, url))
    if target == 'outside' or not isinstance(target, Path) or not target.is_file():
        errors.append('Missing local link: ' + rel + ' -> ' + url)
    elif parsed.fragment and target.suffix.lower() == '.html':
        pending.append((rel, url, target.relative_to(ROOT).as_posix(), unquote(parsed.fragment)))


def check_local(errors):
    html_pages = {}
    external = {}
    pending = []
    for path in pages():
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding='utf-8', errors='replace')
        visible = text
        for allowed in ALLOWED_SERVER_PRS:
            visible = visible.replace(allowed, '')
        if PRIVATE_REPO.search(visible):
            errors.append('Private repository URL: ' + rel)
        if any(item in text for item in UNACTIVATED):
            errors.append('Unactivated API-host path: ' + rel)
        suffix = path.suffix.lower()
        if suffix == '.html':
            page = Page()
            page.feed(text)
            html_pages[rel] = page
            if not any(page.nav_labels):
                errors.append('No labeled navigation: ' + rel)
            if not any(tag == 'link' and 'icon' in rel_attr for tag, rel_attr, url in page.links):
                errors.append('No favicon link: ' + rel)
            style_sources = element_sources(page.csp, 'style')
            script_sources = element_sources(page.csp, 'script')
            image_sources = element_sources(page.csp, 'image')
            for tag, rel_attr, url in page.links:
                parsed = urlsplit(url)
                same_origin = not parsed.scheme and not parsed.netloc and bool(parsed.path)
                if tag == 'link' and 'stylesheet' in rel_attr and same_origin and not allows_self(style_sources):
                    errors.append('Stylesheet blocked by CSP: ' + rel + ' -> ' + url)
                if tag == 'script' and same_origin and not allows_self(script_sources):
                    errors.append('Script blocked by CSP: ' + rel + ' -> ' + url)
                if tag == 'link' and 'icon' in rel_attr and same_origin and not allows_self(image_sources):
                    errors.append('Icon blocked by CSP: ' + rel + ' -> ' + url)
                record(rel, url, path, pending, external, errors)
        elif suffix in {'.js', '.mjs'}:
            for url in js_links(text):
                record(rel, url, path, pending, external, errors)
        elif path.name in ('api-catalog', 'api-catalog.json'):
            for url in linkset_urls(json.loads(text)):
                record(rel, url, path, pending, external, errors)
        else:
            seen = []
            for url in markdown_links(text) + bare_urls(text):
                if url not in seen:
                    seen.append(url)
                    record(rel, url, path, pending, external, errors)
    for rel, url, target_rel, fragment in pending:
        if target_rel not in html_pages:
            parser = Page()
            parser.feed((ROOT / target_rel).read_text(encoding='utf-8', errors='replace'))
            html_pages[target_rel] = parser
        if fragment not in html_pages[target_rel].ids:
            errors.append('Missing anchor: ' + rel + ' -> ' + url)
    errors[:] = list(dict.fromkeys(errors))
    return external


def fetch(url, read_body):
    request = Request(url, headers={'User-Agent': 'covenant-docs-link-check/1.0'})
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            body = response.read(200_001) if read_body else b''
            return response.status, response.geturl(), response.headers.get('content-type', ''), body
    except HTTPError as error:
        return error.code, url, '', b''
    except Exception as error:
        # Timeout, RemoteDisconnected, SSLError and other transport faults stay warnings.
        return type(error).__name__, str(error)[:200], '', b''


def fragment_present(body, fragment):
    text = body.decode('utf-8', 'replace')
    return fragment in FRAGMENT_ATTR.findall(text)


def check_external(external, warnings):
    def once(url):
        fragments = external[url]['fragments']
        status, final, content_type, body = fetch(url, bool(fragments))
        if not isinstance(status, int) or status >= 500:
            status, final, content_type, body = fetch(url, bool(fragments))
        return url, status, final, content_type, body

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(once, url) for url in sorted(external)]
        for future in as_completed(futures):
            url, status, final, content_type, body = future.result()
            where = external[url]['where'][0]
            if status == 405 and url.rstrip('/') == MCP_POST:
                warnings.append('POST-only MCP endpoint (GET 405): ' + where)
            elif status in (401, 403):
                warnings.append('Restricted link HTTP ' + str(status) + ': ' + where)
            elif isinstance(status, int) and status < 400:
                if external[url]['fragments'] and 'html' in content_type.lower():
                    if len(body) >= 200_001:
                        warnings.append('Fragment not confirmed in the first 200KB: ' + where)
                    else:
                        for fragment in external[url]['fragments']:
                            if not fragment_present(body, fragment):
                                warnings.append('External fragment not in the HTML: ' + where)
            else:
                # Third-party 404s and transport errors are reported and do not fail CI.
                warnings.append('External link ' + str(status) + ': ' + where + ' final ' + str(final))
    warnings[:] = list(dict.fromkeys(warnings))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='skip HTTP fetches')
    args = parser.parse_args()
    errors = []
    warnings = []
    external = check_local(errors)
    if not args.offline:
        check_external(external, warnings)
    result = {'status': 'FAIL' if errors else 'PASS', 'errors': errors, 'warnings': warnings,
              'external_links': 0 if args.offline else len(external)}
    print(json.dumps(result, indent=2))
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
