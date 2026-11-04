#!/usr/bin/env python3
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from registry_view import SERVER_PATH, find_payments, find_tools, normalize, projection_source_ok

ROOT = Path(__file__).resolve().parents[1]


class RegistryViewTest(unittest.TestCase):
    def test_docs_projection_passes_through(self):
        doc = json.loads((ROOT / 'distribution' / 'capability-registry.json').read_text())
        self.assertEqual(normalize(doc)['public_tools'], doc['public_tools'])
        self.assertEqual(len(normalize(doc)['payments']), len(doc['payments']))

    def test_nested_server_shape(self):
        doc = {
            'schema': 'example-nested-shape-not-a-claim-about-pr-200',
            'public_mcp': {'tools': [{'name': 'covenant_contract__draft'}, {'name': 'aap_public_listing_search'}]},
            'payment_methods': {'methods': [{
                'id': 'usdc-base', 'label': 'USDC on Base', 'readiness': 'CONFIGURED_UNVERIFIED',
                'settlement_enabled': False, 'readiness_label': 'Configured, not yet verified'}]},
        }
        view = normalize(doc)
        self.assertEqual(view['public_tools'], ['covenant_contract__draft', 'aap_public_listing_search'])
        self.assertEqual(view['payments'][0]['badge'], 'CONFIGURED_UNVERIFIED')
        self.assertEqual(view['payments'][0]['plain'], 'Configured, not yet verified')
        self.assertFalse(view['payments'][0]['settlement_enabled'])

    def test_unknown_shape_fails(self):
        with self.assertRaises(ValueError):
            normalize({'unrelated': True})

    def test_source_path_constant(self):
        self.assertEqual(SERVER_PATH, 'covenant_chain/data/capability_registry.json')
        doc = {'source_path': SERVER_PATH}
        self.assertTrue(projection_source_ok(doc))
        self.assertEqual(find_tools({'tools': ['covenant_contract__draft']}), ['covenant_contract__draft'])
        self.assertEqual(find_payments({'methods': [{'id': 'card', 'readiness': 'NOT_CONNECTED'}]})[0]['id'], 'card')


if __name__ == '__main__':
    unittest.main()
