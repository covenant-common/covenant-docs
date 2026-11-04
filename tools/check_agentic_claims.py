#!/usr/bin/env python3
"""Fail when docs claim Covenant holds or receives customer funds, or that payment is live."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_site import FUNDS_SENTENCE, ROOT
from registry_view import SERVER_COPY, normalize, server_registry_errors

REGISTRY = json.loads((ROOT / 'distribution' / 'capability-registry.json').read_text())
ALLOWED = {'Live', 'Test mode', 'Sandbox', 'Library only', 'Planned', 'Not planned'}
DATE = re.compile(r'^\d{4}-\d{2}(?:-\d{2})?$')
TAG = re.compile(r'<[^>]+>')
NEGATION = re.compile(
    r'(?:never|not|no|does not|do not|doesn\'t|don\'t|cannot|can\'t|will not|won\'t)(?:\s+\w+){0,4}\s+$',
    re.I,
)
CLAIMS = (
    (re.compile(r'\bwe hold\b', re.I), 'we hold'),
    (re.compile(r'\bcovenant holds\b', re.I), 'Covenant holds'),
    (re.compile(r'\bpay covenant\b', re.I), 'pay Covenant'),
    (re.compile(r'\bcovenant receives\b', re.I), 'Covenant receives'),
    (re.compile(r'\bholds your money\b', re.I), 'holds your money'),
    (re.compile(r'\bcovenant is the merchant of record\b', re.I), 'Covenant is the merchant of record'),
    (re.compile(r'\bis unregulated\b', re.I), 'is unregulated'),
    (re.compile(r'\bis exempt\b', re.I), 'is exempt'),
    (re.compile(r'\bpay now\b', re.I), 'pay now'),
    (re.compile(r'\bpayments are live\b', re.I), 'payments are live'),
    (re.compile(r'\bpayment is live\b', re.I), 'payment is live'),
)
REQUIRED = (
    'index.html',
    'docs/PAY.html',
    'docs/PAYING.html',
    'docs/PAYMENTS.html',
    'docs/APPROVALS.html',
    'docs/TRUST_AND_LEGAL.html',
    'llms.txt',
    'docs/AGENT_START.html.md',
)


def visible(text):
    text = re.sub(r'<script\b[^>]*>.*?</script>', ' ', text, flags=re.I | re.DOTALL)
    text = re.sub(r'<style\b[^>]*>.*?</style>', ' ', text, flags=re.I | re.DOTALL)
    return re.sub(r'\s+', ' ', TAG.sub(' ', text))


def prohibited(text):
    found = []
    for pattern, label in CLAIMS:
        for match in pattern.finditer(text):
            prefix = text[max(0, match.start() - 48):match.start()]
            if NEGATION.search(prefix):
                continue
            found.append(label)
    return found


def public_files():
    found = [ROOT / 'index.html', ROOT / 'PRIVACY.html', ROOT / 'llms.txt', ROOT / 'docs' / 'AGENT_START.html.md']
    found.extend(path for path in (ROOT / 'docs').rglob('*.html') if 'technical' not in path.parts)
    found.extend((ROOT / 'sandbox').rglob('*.html'))
    return [path for path in found if path.is_file()]


def main():
    errors = []
    errors.extend(server_registry_errors())
    server = normalize(json.loads(SERVER_COPY.read_text()))
    if server['public_tools'] != REGISTRY.get('public_tools'):
        errors.append('Projection tools do not match the server registry file')
    if server.get('platform_fee_bps') != REGISTRY.get('platform_fee_bps'):
        errors.append('Projection fee does not match the server registry file')
    if server.get('sandbox') != REGISTRY.get('sandbox'):
        errors.append('Projection sandbox does not match the server registry file')
    if REGISTRY.get('can_pay') is not False:
        errors.append('can_pay must be false')
    for row in REGISTRY.get('payments', []):
        if row.get('fund_holder'):
            errors.append('Unexpected fund_holder on ' + row.get('id', '?'))
        if row.get('settlement_enabled'):
            errors.append('Settlement enabled while can_pay is false: ' + row.get('id', '?'))
    seen = set()
    for row in REGISTRY.get('standards', []):
        if row['status'] not in ALLOWED:
            errors.append('Bad status for ' + row['id'])
        if row['status'] == 'Live' and row['id'] != 'mcp-2025-11-25':
            errors.append('Only the public MCP may be Live: ' + row['id'])
        if not str(row.get('source', '')).startswith('https://'):
            errors.append('Standard source must be an https URL: ' + row['id'])
        if not DATE.match(row.get('source_date', '')):
            errors.append('Standard needs a source date: ' + row['id'])
        seen.add(row['id'])
    if len(seen) != len(REGISTRY.get('standards', [])):
        errors.append('Duplicate standard id')
    page = ROOT / 'docs' / 'AGENTIC_COMMERCE.html'
    if page.is_file():
        body = page.read_text()
        found = {}
        for name, status in re.findall(r'<tr><td[^>]*>(.*?)</td><td[^>]*>.*?</td><td[^>]*>(.*?)</td>', body, flags=re.S):
            found[re.sub(r'\s+', ' ', TAG.sub('', name)).strip()] = re.sub(r'\s+', ' ', TAG.sub('', status)).strip()
        for row in REGISTRY.get('standards', []):
            if found.get(row['name']) != row['status']:
                errors.append('D1 status for %s is %s, registry says %s' % (row['id'], found.get(row['name']), row['status']))
    else:
        errors.append('Missing docs/AGENTIC_COMMERCE.html')
    for rel in REQUIRED:
        text = visible((ROOT / rel).read_text())
        if FUNDS_SENTENCE not in text:
            errors.append('Missing the never-holds sentence: ' + rel)
    for path in public_files():
        hits = prohibited(visible(path.read_text()))
        for hit in hits:
            errors.append(path.relative_to(ROOT).as_posix() + ' implies customer funds or a live payment: ' + hit)
    print({'status': 'FAIL' if errors else 'PASS', 'errors': errors})
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
