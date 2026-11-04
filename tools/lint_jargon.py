#!/usr/bin/env python3
"""Fail when a glossary tooltip term appears in prose without an explanation."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_site import TOOLTIPS, pages

ROOT = Path(__file__).resolve().parents[1]


def prose(text):
    text = re.sub(r'<script\b[^>]*>.*?</script>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style\b[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<code\b[^>]*>.*?</code>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<pre\b[^>]*>.*?</pre>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<abbr\b[^>]*>.*?</abbr>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    return re.sub(r'<[^>]+>', ' ', text)


def main():
    errors = []
    for path in pages():
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith('docs/technical/'):
            continue
        raw = path.read_text()
        visible = prose(raw)
        for term in TOOLTIPS:
            explained = re.search(r'<abbr class="term"[^>]*>' + re.escape(term) + r'</abbr>', raw, re.I)
            if re.search(r'\b' + re.escape(term) + r'\b', visible, re.I) and not explained:
                errors.append(rel + ' explains nothing for ' + term)
    print({'status': 'FAIL' if errors else 'PASS', 'errors': errors[:30], 'count': len(errors)})
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
