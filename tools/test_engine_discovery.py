"""Offline candidate publication guards; no core import, credentials or network."""
from copy import deepcopy
import hashlib
from html.parser import HTMLParser
import json
import unittest

import build_engine_discovery as engine
import build_public_discovery as public


class Examples(HTMLParser):
    def __init__(self):
        super().__init__()
        self.capture = False
        self.packets = []

    def handle_starttag(self, tag, attrs):
        if tag == 'pre' and dict(attrs).get('class') == 'engine-request':
            self.capture = True

    def handle_endtag(self, tag):
        if tag == 'pre':
            self.capture = False

    def handle_data(self, value):
        if self.capture:
            self.packets.append(json.loads(value))


class PreparedEngineDiscovery(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(engine.SOURCE.read_text())

    def test_complete_descriptors_and_output_hash_match_without_source_mutation(self):
        original = deepcopy(self.source)
        output = engine.documents(self.source)
        self.assertEqual(self.source, original)
        self.assertEqual(set(output), {engine.CARD, engine.INVENTORY})
        inventory = json.loads(output[engine.INVENTORY])
        card = json.loads(output[engine.CARD])
        meta = card['_meta']['io.github.covenant-common/hosted-engine-candidate']
        self.assertEqual(inventory['tools'], self.source['entryTools'])
        self.assertEqual(meta['entryToolSchemas'], inventory['tools'])
        self.assertEqual(meta['inventorySha256'], hashlib.sha256(output[engine.INVENTORY]).hexdigest())
        self.assertEqual(meta['inventoryUrl'], engine.WEBSITE + '/' + engine.INVENTORY)
        self.assertEqual(card['remotes'][0]['url'], inventory['endpoint'])
        self.assertFalse(inventory['tools'][-1]['annotations']['readOnlyHint'])
        self.assertTrue(inventory['access']['covenantCallMayWrite'])
        self.assertFalse(meta['liveObservation'])

    def test_schema_omission_new_tool_or_false_readonly_hint_requires_successor(self):
        cases = []
        missing = deepcopy(self.source); missing['entryTools'].pop(); cases.append(missing)
        duplicate = deepcopy(self.source); duplicate['entryTools'][0] = duplicate['entryTools'][1]; cases.append(duplicate)
        schema = deepcopy(self.source); schema['entryTools'][1]['inputSchema']['properties'].pop('kind'); cases.append(schema)
        write = deepcopy(self.source); write['entryTools'][-1]['annotations']['readOnlyHint'] = True; cases.append(write)
        for case in cases:
            with self.subTest(rows=case['entryTools']):
                with self.assertRaises(ValueError):
                    engine.documents(case)

    def test_activation_or_origin_drift_cannot_enter_prepared_profile(self):
        for field, value in [('status', 'LIVE'), ('origin', 'https://example.invalid'),
                             ('protocolVersion', '2099-01-01'), ('profile', 'urn:aap:hosted-engine-mcp:2')]:
            case = deepcopy(self.source); case[field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                engine.documents(case)
        case = deepcopy(self.source); case['activation']['sourceDefault'] = True
        with self.assertRaises(ValueError):
            engine.documents(case)

    def test_original_nine_schema_inventory_and_active_aliases_stay_byte_exact(self):
        original = public.documents(json.loads(public.SOURCE.read_text()))
        candidate_paths = set(engine.documents(self.source))
        self.assertFalse(candidate_paths.intersection(original))
        for path, (_media, body) in original.items():
            with self.subTest(path=path):
                self.assertEqual((engine.ROOT / path).read_bytes(), body)
        self.assertEqual(len(json.loads(original['mcp/tool-inventory.json'][1])['tools']), 9)

    def test_guide_requests_select_all_four_exact_entry_tools_and_mounted_read_action(self):
        parser = Examples()
        parser.feed((engine.ROOT / 'docs/API_MCP.html').read_text())
        packets = parser.packets
        self.assertEqual(tuple(p['params']['name'] for p in packets), engine.ENTRY)
        schemas = {row['name']: row['inputSchema'] for row in self.source['entryTools']}
        for index, packet in enumerate(packets, 1):
            self.assertEqual((packet['jsonrpc'], packet['method'], packet['id']), ('2.0', 'tools/call', index))
            args = packet['params']['arguments']
            schema = schemas[packet['params']['name']]
            self.assertTrue(set(schema['required']).issubset(args))
            self.assertTrue(set(args).issubset(schema['properties']))
        self.assertEqual(packets[1]['params']['arguments']['kind'], 'features')
        selected = packets[2]['params']['arguments']['tool']
        self.assertEqual(selected, 'covenant_offline__spec')
        self.assertEqual(packets[3]['params']['arguments'], {'tool': selected, 'arguments': {}})
        meta = json.loads(engine.documents(self.source)[engine.CARD])
        self.assertEqual(meta['websiteUrl'], engine.WEBSITE + '/docs/API_MCP.html#engine')


if __name__ == '__main__':
    unittest.main()
