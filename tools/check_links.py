#!/usr/bin/env python3
"""Check site links, anchors, stylesheet policy and private-repository URLs.

Local files and fragments are always checked. HTTP links are fetched unless
--offline is set. A 404 or an unactivated private-repository URL fails the
run. Login walls (401/403) and the POST-only public MCP endpoint are reported
and do not fail the run.
"""
import argparse
import json
import re
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://covenant-common.github.io/covenant-docs'
SKIP = {'pyodide', 'node_modules'}
PRIVATE_REPO = re.compile(r'github\.com/covenant-common/covenant(?!-)')
UNACTIVATED_CARD = 'jupie202020.pythonanywhere.com/mcp/server-card'
MCP_POST = 'https://jupie202020.pythonanywhere.com/mcp'
NAV_RULE = re.compile(r'<nav\b', re.I)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()
        self.csp = None
        self.navs = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(unquote(a['id']))
        if tag == 'a' and a.get('name'):
            self.ids.add(unquote(a['name']))
        if tag == 'nav':
            self.navs += 1
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
        if not path.is_file() or SKIP.intersection(path.parts):
            continue
        rel = path.relative_to(ROOT).as_posix()
        if path.suffix.lower() == '.html' or path.suffix.lower() in {'.md', '.txt'} or rel in {
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


def linkset_hrefs(value):
    found = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key == 'href' and isinstance(item, str):
                found.append(item)
            else:
                found.extend(linkset_hrefs(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(linkset_hrefs(item))
    return found


def source_policy(csp, kind):
    if not csp:
        return None
    directives = {}
    for part in csp.split(';'):
        bits = part.strip().split()
        if bits:
            directives[bits[0].lower()] = bits[1:]
    return directives.get(kind) or directives.get('default-src')


def allows_self(sources):
    return sources is None or any(item in ("'self'", '*') or item.endswith(':') for item in sources)


def own_site(url):
    """Map a published docs URL back to a file in this repository, when it is one."""
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or parsed.netloc != 'covenant-common.github.io':
        return None
    prefix = '/covenant-docs'
    if parsed.path != prefix and not parsed.path.startswith(prefix + '/'):
        return None
    rel = parsed.path[len(prefix):].lstrip('/')
    if rel in ('',):
        rel = 'index.html'
    target = (ROOT / unquote(rel)).resolve()
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


def check_local(errors):
    html_pages = {}
    external = {}
    pending = []
    for path in pages():
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding='utf-8')
        if PRIVATE_REPO.search(text):
            errors.append('Private repository URL: ' + rel)
        if UNACTIVATED_CARD in text and rel.endswith(('.html', '.md', '.txt', 'api-catalog', 'api-catalog.json')):
            errors.append('Unactivated API-host server card: ' + rel)
        if path.suffix.lower() == '.html':
            page = Page()
            page.feed(text)
            html_pages[rel] = page
            if page.navs < 1:
                errors.append('No navigation: ' + rel)
            if not any(tag == 'link' and 'icon' in rel_attr for tag, rel_attr, url in page.links):
                errors.append('No favicon link: ' + rel)
            for tag, rel_attr, url in page.links:
                parsed = urlsplit(url)
                if parsed.scheme in ('http', 'https'):
                    owned = own_site(url)
                    if owned == 'outside' or (isinstance(owned, Path) and not owned.is_file()):
                        errors.append('Missing local link: ' + rel + ' -> ' + url)
                    elif owned is None:
                        external.setdefault(url.split('#')[0], []).append(rel + ' -> ' + url)
                    continue
                if parsed.scheme in ('mailto', 'javascript', 'data') or (not parsed.path and not parsed.fragment):
                    continue
                target = local_target(path, url)
                if target == 'outside' or target is None or not target.is_file():
                    errors.append('Missing local link: ' + rel + ' -> ' + url)
                    continue
                if parsed.fragment and target.suffix.lower() == '.html':
                    target_rel = target.relative_to(ROOT).as_posix()
                    html_pages.setdefault(target_rel, None)
            style_sources = source_policy(page.csp, 'style-src')
            script_sources = source_policy(page.csp, 'script-src')
            image_sources = source_policy(page.csp, 'img-src')
            for tag, rel_attr, url in page.links:
                parsed = urlsplit(url)
                if parsed.scheme or parsed.netloc:
                    continue
                same_origin = bool(parsed.path)
                if tag == 'link' and 'stylesheet' in rel_attr and same_origin and not allows_self(style_sources):
                    errors.append('Stylesheet blocked by CSP: ' + rel + ' -> ' + url)
                if tag == 'script' and same_origin and not allows_self(script_sources):
                    errors.append('Script blocked by CSP: ' + rel + ' -> ' + url)
                if tag == 'link' and 'icon' in rel_attr and same_origin and not allows_self(image_sources):
                    errors.append('Icon blocked by CSP: ' + rel + ' -> ' + url)
        elif path.name in ('api-catalog', 'api-catalog.json'):
            for url in linkset_hrefs(json.loads(text)):
                parsed = urlsplit(url)
                if parsed.scheme not in ('http', 'https'):
                    continue
                owned = own_site(url)
                if owned == 'outside' or (isinstance(owned, Path) and not owned.is_file()):
                    errors.append('Missing local link: ' + rel + ' -> ' + url)
                elif isinstance(owned, Path) and parsed.fragment and owned.suffix.lower() == '.html':
                    pending.append((rel, url, owned.relative_to(ROOT).as_posix(), unquote(parsed.fragment)))
                elif owned is None:
                    external.setdefault(url.split('#')[0], []).append(rel + ' -> ' + url)
        else:
            for url in markdown_links(text):
                parsed = urlsplit(url)
                if parsed.scheme in ('http', 'https'):
                    owned = own_site(url)
                    if owned == 'outside' or (isinstance(owned, Path) and not owned.is_file()):
                        errors.append('Missing local link: ' + rel + ' -> ' + url)
                    elif isinstance(owned, Path) and parsed.fragment and owned.suffix.lower() == '.html':
                        pending.append((rel, url, owned.relative_to(ROOT).as_posix(), unquote(parsed.fragment)))
                    elif owned is None:
                        external.setdefault(url.split('#')[0], []).append(rel + ' -> ' + url)
                elif parsed.scheme in ('mailto', 'javascript', 'data'):
                    continue
                elif parsed.path:
                    target = local_target(path, url)
                    if target == 'outside' or target is None or not target.is_file():
                        errors.append('Missing local link: ' + rel + ' -> ' + url)
                    elif isinstance(target, Path) and parsed.fragment and target.suffix.lower() == '.html':
                        pending.append((rel, url, target.relative_to(ROOT).as_posix(), unquote(parsed.fragment)))
    for rel, page in list(html_pages.items()):
        if page is None:
            parser = Page()
            parser.feed((ROOT / rel).read_text(encoding='utf-8'))
            html_pages[rel] = parser
    for rel, page in html_pages.items():
        for tag, rel_attr, url in page.links:
            parsed = urlsplit(url)
            if not parsed.fragment:
                continue
            if parsed.scheme in ('http', 'https'):
                target = own_site(url)
                if not isinstance(target, Path):
                    continue
            elif parsed.scheme:
                continue
            else:
                target = local_target(ROOT / rel, url)
            if not isinstance(target, Path):
                continue
            target_rel = target.relative_to(ROOT).as_posix()
            if target_rel in html_pages and unquote(parsed.fragment) not in html_pages[target_rel].ids:
                errors.append('Missing anchor: ' + rel + ' -> ' + url)
    for rel, url, target_rel, fragment in pending:
        if target_rel not in html_pages:
            parser = Page()
            parser.feed((ROOT / target_rel).read_text(encoding='utf-8'))
            html_pages[target_rel] = parser
        if fragment not in html_pages[target_rel].ids:
            errors.append('Missing anchor: ' + rel + ' -> ' + url)
    return external


def fetch(url):
    request = Request(url, headers={'User-Agent': 'covenant-docs-link-check/1.0'})
    try:
        with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
            return response.status, response.geturl()
    except HTTPError as error:
        return error.code, url
    except URLError as error:
        return 'URLError', str(error.reason)


def check_external(external, errors, warnings):
    def once(url):
        status, final = fetch(url)
        if status == 'URLError' or (isinstance(status, int) and status >= 500):
            status, final = fetch(url)
        return url, status, final

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(once, url) for url in sorted(external)]
        for future in as_completed(futures):
            url, status, final = future.result()
            where = external[url][0]
            if status == 405 and url.rstrip('/') == MCP_POST:
                warnings.append('POST-only MCP endpoint (GET 405): ' + where)
            elif status in (401, 403):
                warnings.append('Restricted link HTTP ' + str(status) + ': ' + where)
            elif isinstance(status, int) and status < 400:
                continue
            elif status in (429,) or status == 'URLError' or (isinstance(status, int) and status >= 500):
                warnings.append('Unconfirmed link ' + str(status) + ': ' + where)
            else:
                errors.append('Broken link HTTP ' + str(status) + ': ' + where + ' final ' + str(final))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='skip HTTP fetches')
    args = parser.parse_args()
    errors = []
    warnings = []
    external = check_local(errors)
    if not args.offline:
        check_external(external, errors, warnings)
    result = {'status': 'FAIL' if errors else 'PASS', 'errors': errors, 'warnings': warnings,
              'external_links': 0 if args.offline else len(external)}
    print(json.dumps(result, indent=2))
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
