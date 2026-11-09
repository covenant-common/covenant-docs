#!/usr/bin/env python3
"""Fail when prose puts a number word next to tools. Counts come from the registry."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORD = r'(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)'
GAP = r'(?:free|public|mcp|hosted|anonymous|search|draft|drafting|review|and)'
PATTERN = re.compile(r'\b' + WORD + r'(?:[-\s,]+' + GAP + r')*[-\s,]+tools?\b', re.I)
SKIP = {'node_modules', '.git', 'pyodide', 'testing'}


def files():
    found = []
    for path in ROOT.rglob('*'):
        if any(part in SKIP for part in path.parts):
            continue
        if path.suffix.lower() in {'.html', '.md', '.txt', '.json'} and path.is_file():
            found.append(path)
    return found


def main():
    errors = []
    for path in files():
        for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
            if PATTERN.search(line):
                errors.append('%s:%s %s' % (path.relative_to(ROOT).as_posix(), lineno, line.strip()[:160]))
    print({'status': 'FAIL' if errors else 'PASS', 'errors': errors[:40], 'count': len(errors)})
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
