#!/usr/bin/env python3
"""Prepare versioned engine metadata offline; never replace active discovery.

These are public interface descriptors, not a core implementation or a live
observation. Activation requires a separately reviewed live discovery successor.
The original nine-tool observation and its generator remain unchanged.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026-11-10.v1'
FORMAT = 'aap-hosted-engine-candidate/' + VERSION
PROFILE = 'urn:aap:hosted-engine-mcp:0.1'
ORIGIN = 'https://jupie202020.pythonanywhere.com'
WEBSITE = 'https://covenant-common.github.io/covenant-docs'
SOURCE = ROOT / ('distribution/engine-mcp-candidate-' + VERSION + '.json')
INVENTORY = 'mcp/engine-tool-inventory-' + VERSION + '.json'
CARD = 'mcp/engine-server-card-' + VERSION + '.json'
ENTRY = ('covenant_onboard', 'covenant_find', 'covenant_explain', 'covenant_call')
SCHEMA_PIN = '6d739ec80e85ef0498bccd82840fc8506b0dee07ec9c55b11f668cffef39a628'


def wire(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + '\n').encode('ascii')


def documents(source):
    if (source.get('format') != FORMAT or source.get('profile') != PROFILE or
            source.get('origin') != ORIGIN or source.get('status') != 'PREPARED_NOT_ACTIVATED' or
            source.get('protocolVersion') != '2025-11-25'):
        raise ValueError('A new engine profile or live observation needs explicit review')
    rows = source.get('entryTools')
    if (type(rows) is not list or len(rows) != len(ENTRY) or
            any(type(row) is not dict for row in rows) or
            tuple(row.get('name') for row in rows) != ENTRY or
            hashlib.sha256(wire(rows)).hexdigest() != SCHEMA_PIN):
        raise ValueError('Preserve complete reviewed schemas; use a versioned successor for changes')
    activation = source.get('activation')
    if activation != {'operatorOption': 'engine_access=True', 'sourceDefault': False,
                      'requiresFreshLiveDiscovery': True}:
        raise ValueError('Prepared metadata cannot activate an engine')
    tools = deepcopy(rows)
    inventory = {
        'format': 'aap-hosted-engine-tool-inventory/' + VERSION,
        'profile': PROFILE, 'status': source['status'],
        'endpoint': ORIGIN + '/mcp/engine/v1',
        'endpointAliasesWhenEnabled': [ORIGIN + '/mcp', ORIGIN + '/mcp/agent/v1'],
        'protocolVersion': source['protocolVersion'], 'preparedDate': source['preparedDate'],
        'source': deepcopy(source['source']), 'entryToolCount': len(tools), 'tools': tools,
        'catalogueScope': deepcopy(source['catalogueScope']),
        'activation': deepcopy(activation),
        'access': {
            'discoveryAndReviewedKeylessActions': 'No account or key',
            'accountActions': 'Current scoped bearer grant checked on every request',
            'signingKeysAccepted': False,
            'covenantCallMayWrite': True,
            'sandbox': 'Optional separate role-scoped test credentials; fictional balances',
            'otherFeatures': 'Read actual owner, provider, hardware, SDK or unresolved requirements'},
        'currentAuthority': 'Read host discovery and tools/list before use. This is not a live observation.',
        'fullSchemaLookup': {'tool': 'covenant_explain', 'arguments': {'tool': 'covenant_offline__spec'}},
    }
    inventory_bytes = wire(inventory)
    card = {
        '$schema': 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
        'name': 'io.github.covenant-common/aap-engine', 'version': '0.1-prepared.20261110.1',
        'title': 'Covenant engine — prepared connection profile',
        'description': 'Discover capabilities and call available actions. Account writes require current scoped permission.',
        'websiteUrl': WEBSITE + '/docs/API_MCP.html#engine',
        'remotes': [{'type': 'streamable-http', 'url': inventory['endpoint'],
                     'supportedProtocolVersions': [source['protocolVersion']]}],
        '_meta': {'io.github.covenant-common/hosted-engine-candidate': {
            'status': source['status'], 'profile': PROFILE,
            'preparedDate': source['preparedDate'], 'liveObservation': False,
            'entryToolCount': len(tools), 'entryToolNames': list(ENTRY),
            'entryToolSchemas': deepcopy(tools),
            'inventoryUrl': WEBSITE + '/' + INVENTORY,
            'inventorySha256': hashlib.sha256(inventory_bytes).hexdigest(),
            'currentListingMethod': 'tools/list',
            'fullSchemaLookup': inventory['fullSchemaLookup'],
            'activation': deepcopy(activation),
            'accountActionsNeedScopedPermission': True, 'signingKeysAccepted': False,
            'note': 'Review artifact only. Active well-known aliases and historical nine-tool metadata are unchanged.'}},
    }
    return {INVENTORY: inventory_bytes, CARD: wire(card)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, body in documents(json.loads(SOURCE.read_text())).items():
        path = ROOT / name
        if args.check:
            if not path.is_file() or path.read_bytes() != body:
                raise SystemExit('FAIL: stale prepared engine metadata ' + name)
        else:
            path.write_bytes(body)
    print(json.dumps({'status': 'PASS', 'entryTools': len(ENTRY),
                      'activation': 'NOT_PERFORMED', 'activeMetadataChanged': False}))


if __name__ == '__main__':
    main()
