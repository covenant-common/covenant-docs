#!/usr/bin/env python3
"""Published text must not contain a raw TODO(owner) marker."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = 'TODO(owner)'


def visible(text):
    return re.sub(r'<!--.*?-->', '', text, flags=re.S)


def main():
    errors = []
    for path in [ROOT / 'index.html', ROOT / 'llms.txt', ROOT / 'docs' / 'AGENT_START.html.md', *sorted((ROOT / 'docs').rglob('*.html'))]:
        text = path.read_text()
        if path.suffix == '.html':
            for content in re.findall(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', text):
                if MARKER in content:
                    errors.append(path.relative_to(ROOT).as_posix() + ' meta description')
            text = visible(text)
        if MARKER in text:
            errors.append(path.relative_to(ROOT).as_posix())
    glossary_path = ROOT / 'distribution' / 'glossary.json'
    if MARKER in glossary_path.read_text():
        errors.append('distribution/glossary.json')
    print({'status': 'FAIL' if errors else 'PASS', 'errors': errors})
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
