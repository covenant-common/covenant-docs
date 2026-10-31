"""Version local style/script URLs by their bytes; leave page text intact."""
import argparse
import hashlib
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = re.compile(r'''((?:href|src)=["'])([^"']+)(["'])''')


def rewrite(text, page, root=ROOT):
    def one(match):
        url = urlsplit(match[2])
        if url.scheme or url.netloc or not url.path.endswith(('.css', '.js', '.mjs')):
            return match[0]
        asset = (page.parent / url.path).resolve()
        if not asset.is_relative_to(root.resolve()) or not asset.is_file():
            return match[0]
        version = hashlib.sha256(asset.read_bytes()).hexdigest()[:16]
        target = url.path + '?v=' + version + ('#' + url.fragment if url.fragment else '')
        return match[1] + target + match[3]
    return REFERENCE.sub(one, text)


def pages(root=ROOT):
    return [root / 'index.html', *sorted((root / 'docs').rglob('*.html')),
            *sorted((root / 'sandbox').rglob('*.html'))]


def outdated(root=ROOT):
    return [page.relative_to(root).as_posix() for page in pages(root)
            if page.read_text() != rewrite(page.read_text(), page, root)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    changed = outdated()
    if not args.check:
        for page in pages():
            page.write_text(rewrite(page.read_text(), page))
    print({'status': 'FAIL' if args.check and changed else 'PASS', 'pages': len(pages()),
           'changed_or_outdated': changed})
    return int(args.check and bool(changed))


if __name__ == '__main__':
    raise SystemExit(main())
