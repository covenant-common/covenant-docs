#!/usr/bin/env python3
"""Fail when pages, llms.txt or the payment labels drift from the vendored registry."""
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from registry_view import PROJECTION, SERVER_COPY, SERVER_PATH, normalize, projection_source_ok, server_registry_errors

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = json.loads(PROJECTION.read_text())
INVENTORY = json.loads((ROOT / 'mcp' / 'tool-inventory.json').read_text())


def main():
    errors = server_registry_errors()
    if not projection_source_ok(REGISTRY):
        errors.append('Projection source_path is not ' + SERVER_PATH)
    if SERVER_COPY.is_file():
        server_view = normalize(json.loads(SERVER_COPY.read_text()))
        if server_view['public_tools'] != REGISTRY['public_tools']:
            errors.append('Projection tools differ from the server registry file')
        if server_view.get('sandbox') != REGISTRY.get('sandbox'):
            errors.append('Projection sandbox.works_in_test differs from the server registry file')
        if server_view.get('platform_fee_bps') != REGISTRY.get('platform_fee_bps'):
            errors.append('Projection platform_fee_bps differs from the server registry file')
        server_ids = [(row['id'], row.get('readiness'), row['badge'], row.get('plain')) for row in server_view['payments']]
        projection_ids = [(row['id'], row.get('readiness'), row['badge'], row.get('plain')) for row in REGISTRY['payments']]
        if server_ids != projection_ids:
            errors.append('Projection payments differ from the server registry file')
    else:
        errors.append('Server registry file is not in the checkout')
    tools = REGISTRY['public_tools']
    if len(tools) != len(set(tools)):
        errors.append('Registry tool names are not unique')
    inventory_names = [row['name'] for row in INVENTORY['tools']]
    if sorted(inventory_names) != sorted(tools) or INVENTORY.get('toolCount') != len(tools):
        errors.append('Frozen inventory does not match the registry tool list')
    inventory_sha = hashlib.sha256((ROOT / 'mcp' / 'tool-inventory.json').read_bytes()).hexdigest()
    for label, path, pointer in (
        ('server card', ROOT / '.well-known' / 'mcp' / 'server-card.json', None),
        ('AI catalog', ROOT / '.well-known' / 'ai-catalog.json', ('entries', 0, 'data')),
    ):
        card = json.loads(path.read_text())
        for key in pointer or ():
            card = card[key]
        meta = card['_meta']['io.github.covenant-common/public-tools']
        if sorted(meta.get('names') or []) != sorted(tools) or meta.get('toolCount') != len(tools):
            errors.append(label + ' tool list does not match the registry')
        if meta.get('sha256') != inventory_sha:
            errors.append(label + ' inventory hash does not match mcp/tool-inventory.json')
    llms = (ROOT / 'llms.txt').read_text()
    omitted = [name for name in tools if name not in llms]
    if omitted:
        errors.append('llms.txt omits registry tools: ' + ', '.join(omitted))
    if REGISTRY['first_public_tool'] not in tools:
        errors.append('First public tool is not in the registry')
    for path in (ROOT / 'llms.txt', ROOT / 'skills' / 'covenant-use' / 'SKILL.md',
                 ROOT / 'skills' / 'covenant-use' / 'references' / 'QUICKSTART.md'):
        named = set(re.findall(r'\b(aap_public_[a-z0-9_]+|covenant_[a-z0-9]+__[a-z0-9_]+)\b', path.read_text()))
        unknown = sorted(name for name in named if name not in tools)
        if unknown:
            errors.append(path.name + ' names tools outside the registry: ' + ', '.join(unknown))
    labels = (ROOT / 'assets' / 'payment-options.js').read_text()
    for key, label in REGISTRY['badges'].items():
        if "%s:'%s'" % (key, label) not in labels and '%s:"%s"' % (key, label) not in labels:
            errors.append('Payment badge missing from payment-options.js: ' + key)
    paying = (ROOT / 'docs' / 'PAYING.html').read_text()
    if 'Connection installed' in paying:
        errors.append('PAYING.html still says Connection installed')
    for row in REGISTRY['payments']:
        if 'data-method="%s"' % row['id'] not in paying:
            errors.append('PAYING.html missing payment row ' + row['id'])
        if row['settlement_enabled']:
            errors.append('Registry claims settlement for ' + row['id'])
    if any(row['badge'] == 'LIVE' for row in REGISTRY['payments']):
        errors.append('A payment row is badged Live. The vendored catalogue has none.')
    print({'status': 'FAIL' if errors else 'PASS', 'errors': errors})
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
