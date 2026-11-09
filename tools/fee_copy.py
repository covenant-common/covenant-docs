#!/usr/bin/env python3
"""Generate the fee sentence from the registry and reject duplicates and invented amounts."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SENTENCE = 'The platform fee is not set yet. The owner will confirm this.'
RATE = re.compile(
    r'(?<![\w./-])(?:0\.5\s*%|£\s*0\.60|\$\s*0\.13|USD\s+0\.13|25\.13|120\.60|fee is USD 0|fee is 0\b)',
    re.I,
)
CLAUSES = [
    r'you pay £[\d.]+, the seller gets £[\d.]+, and the fee is £[\d.]+',
    r'(?:On a USD \d+ order, )?[Ww]ith the fee left off, you (?:pay|get) [^.]{0,120}',
    r'At USD \d+, with the fee off, you pay [^.]{0,120}',
    r'(?:The posted (?:standard )?marketplace fee is |The fee is |Covenant[’\']s fee is |It is )?optional (?:during|for) the (?:launch[’\']s )?first 14 calendar days[^.]{0,160}',
    r'This site does not state (?:when that (?:14-day )?window ends|the (?:date or )?clock time that (?:14-day )?window ends)',
    r'After the optional window, the posted rate applies to new [^.]+',
    r'It then applies to new deals in supported currencies',
    r'The payer sets (?:<code>fee_opt_in</code>|<abbr class="term"[^>]*>fee_opt_in</abbr>)[^.]{0,220}',
    r'While that choice is off and the fee is not required, the approval check expects (?:a 0 rate|no fee)',
    r'The same split on a USD 25 order: [^.]{0,180}',
    r'The 1 November(?: 2026)? to 1 December 2026 dates are the separate free-posting notice(?:, not the end of the fee window)?',
    r'The <time datetime="2026-11-01">1 November 2026</time> to <time datetime="2026-12-01">1 December 2026</time> dates are the separate free-posting notice, not the end of the fee window',
    r'Fee left off, the default while it is optional:',
    r'Your quote shows the exact fee before approval',
    r'The quote shows the fee before approval; existing activated terms keep their original fee',
    r'Your exact fee is shown before approval',
    r'Agreed fees on existing deals stay unchanged',
    r'An already activated deal keeps its original fee',
]
ROOTS = ('docs', 'plugins', 'skills')
NAMES = {'index.html', 'llms.txt', 'README.md'}


def registry():
    path = ROOT / 'distribution' / 'capability-registry.json'
    return json.loads(path.read_text()) if path.is_file() else {}


def fee_sentence(doc=None):
    doc = registry() if doc is None else doc
    if doc.get('platform_fee_bps') is None:
        return SENTENCE
    return 'The platform fee is %s basis points. The owner set this rate.' % doc['platform_fee_bps']


def published(path):
    rel = path.relative_to(ROOT).as_posix()
    if rel == 'distribution/glossary.json':
        return True
    if path.suffix.lower() not in {'.html', '.md', '.txt', '.js', '.mjs'}:
        return False
    if rel.startswith('docs/technical/'):
        return False
    return rel in NAMES or rel.startswith(ROOTS)


def _park(text):
    blocks = []

    def keep(match):
        blocks.append(match.group(0))
        return '\x00FEE%s\x00' % (len(blocks) - 1)

    text = re.sub(r'<!-- funds-decision:start -->.*?<!-- funds-decision:end -->', keep, text, flags=re.S)
    text = re.sub(r'\[funds-decision\].*?\[/funds-decision\]', keep, text, flags=re.S)
    return text, blocks


def normalize_fee_text(text, sentence=None):
    sentence = sentence or fee_sentence()
    if sentence != SENTENCE:
        return text
    protected, blocks = _park(text)
    protected = re.sub(r'(?:' + re.escape(sentence) + r'[ \t]*)+', '', protected)
    return _restore(protected, blocks)


def _restore(text, blocks):
    for index, block in enumerate(blocks):
        text = text.replace('\x00FEE%s\x00' % index, block)
    return text


def problems(text, rel, sentence):
    if sentence != SENTENCE or rel.startswith('testing/'):
        return []
    errors = []
    outside, _ = _park(text)
    if rel != 'assets/deal-machine.js' and (sentence in outside or SENTENCE in outside):
        errors.append('%s repeats the fee sentence outside the funds block' % rel)
    if 'funds-decision' in text and text.count(sentence) != 1:
        errors.append('%s funds block does not contain the fee sentence once' % rel)
    if rel == 'assets/deal-machine.js' and text.count(sentence) != 1:
        errors.append('assets/deal-machine.js must use the fee sentence once')
    if RATE.search(outside):
        errors.append('%s states a fee amount while the registry fee is not set' % rel)
    return errors


def files():
    found = []
    for path in [ROOT / name for name in NAMES]:
        if path.is_file():
            found.append(path)
    for extra in ('assets/deal-machine.js', 'sandbox/page.js', 'distribution/glossary.json'):
        path = ROOT / extra
        if path.is_file():
            found.append(path)
    for folder in ROOTS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        for path in base.rglob('*'):
            if path.is_file() and published(path):
                found.append(path)
    return sorted(set(found))


def main():
    sentence = fee_sentence()
    check = '--check' in sys.argv
    changed = []
    for path in files():
        if path.relative_to(ROOT).as_posix() in {'assets/deal-machine.js', 'sandbox/page.js'}:
            continue
        original = path.read_text()
        updated = normalize_fee_text(original, sentence)
        if updated != original:
            changed.append(path.relative_to(ROOT).as_posix())
            if not check:
                path.write_text(updated)
    errors = []
    for path in files():
        errors.extend(problems(path.read_text(), path.relative_to(ROOT).as_posix(), sentence))
    print(json.dumps({'status': 'FAIL' if errors else 'PASS', 'changed': changed, 'errors': errors}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
