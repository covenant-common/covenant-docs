#!/usr/bin/env python3
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from registry_view import SERVER_PATH, find_payments, find_tools, normalize, projection_source_ok, server_registry_errors

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
        with self.assertRaises(ValueError) as caught:
            normalize({'unrelated': True})
        self.assertIn('unrecognised shape: keys', str(caught.exception))
        self.assertIn('unrelated', str(caught.exception))
        self.assertNotIn('missing', str(caught.exception))

    def test_pr201_shape_maps_test_mode_and_keeps_release_planned(self):
        doc = {
            'format': 'covenant-server-capability-registry/0.2',
            'mcp_surface': {'entries': [
                {'tool_name': 'covenant_contract__draft'},
                {'tool_name': 'aap_public_listing_search'},
                {'tool_name': 'covenant_sandbox_session'},
            ]},
            'settlement_rails': [{
                'id': 'usdc-base', 'state': 'CONFIGURED_UNVERIFIED', 'can_settle': False}],
            'sandbox': {'features': [
                {'id': 'mcp-2026-07-28', 'availability': 'test'},
                {'id': 'rfc-9728', 'availability': 'test'},
                {'id': 'agent-card', 'availability': 'test'},
                {'id': 'ap2-v0-2', 'availability': 'test'},
                {'id': 'x402-v2-auth-capture', 'availability': 'test'},
                {'id': 'partial-capture', 'availability': 'test'},
                {'id': 'release', 'availability': 'planned'},
                {'id': 'refund', 'availability': 'planned'},
                {'id': 'reclaim', 'availability': 'planned'},
            ]},
        }
        view = normalize(doc)
        self.assertEqual(view['public_tools'], [
            'covenant_contract__draft', 'aap_public_listing_search', 'covenant_sandbox_session'])
        by_id = {row['id']: row['status'] for row in view['standards_from_server']}
        self.assertEqual(by_id['mcp-2026-07-28'], 'Test mode')
        self.assertEqual(by_id['partial-capture'], 'Test mode')
        self.assertEqual(by_id['release'], 'Planned')
        self.assertEqual(by_id['refund'], 'Planned')
        self.assertEqual(by_id['reclaim'], 'Planned')
        self.assertFalse(view['payments'][0]['settlement_enabled'])

    def test_read_only_string_uses_public_tools_list_and_sandbox(self):
        doc = {
            'schema_version': 1,
            'public_tools': 'read_only',
            'public_tools_list': ['covenant_contract__draft', 'aap_public_listing_search'],
            'can_pay': False,
            'can_sign': False,
            'can_refund': False,
            'can_dispute': False,
            'custody': 'none',
            'holds_funds': False,
            'merchant_of_record': 'seller',
            'methods': [{'id': 'card', 'readiness': 'NOT_CONNECTED'}],
            'payment_methods': [{'id': 'card', 'readiness': 'NOT_CONNECTED'}],
            'sandbox': {'works_in_test': ['release', 'refund', 'server/discover']},
        }
        view = normalize(doc)
        self.assertEqual(view['public_tools_mode'], 'read_only')
        self.assertEqual(view['tool_name_source'], 'public_tools_list')
        self.assertEqual(view['public_tools'], ['covenant_contract__draft', 'aap_public_listing_search'])
        self.assertEqual(view['custody'], 'none')
        self.assertFalse(view['holds_funds'])
        self.assertEqual(view['merchant_of_record'], 'seller')
        self.assertIn('server/discover', view['sandbox']['works_in_test'])
        applied = __import__('registry_view', fromlist=['apply_works_in_test']).apply_works_in_test(
            [{'id': 'mcp-2026-07-28', 'status': 'Planned', 'where': 'old', 'name': 'MCP'},
             {'id': 'release', 'status': 'Planned', 'where': 'old', 'name': 'Release'},
             {'id': 'reclaim', 'status': 'Test mode', 'where': 'old', 'name': 'Reclaim'}],
            view['sandbox']['works_in_test'])
        by_id = {row['id']: row for row in applied}
        self.assertEqual(by_id['mcp-2026-07-28']['status'], 'Test mode')
        self.assertIn('server/discover is offered', by_id['mcp-2026-07-28']['where'])
        self.assertEqual(by_id['release']['status'], 'Test mode')
        self.assertEqual(by_id['reclaim']['status'], 'Planned')

    def test_string_public_tools_falls_back_to_the_server_card(self):
        doc = {
            'public_tools': 'read_only',
            'methods': [{'id': 'card', 'readiness': 'NOT_CONNECTED'}],
            'sandbox': {'works_in_test': []},
        }
        view = normalize(doc)
        self.assertEqual(view['tool_name_source'], 'server-card')
        self.assertIn('covenant_contract__draft', view['public_tools'])

    def test_missing_server_registry_fails_closed(self):
        errors = server_registry_errors(Path('/tmp/covenant-registry-missing.json'))
        self.assertTrue(errors)
        self.assertIn('unrecognised shape: keys', errors[0])
        self.assertNotIn('missing', errors[0])

    def test_source_path_constant(self):
        self.assertEqual(SERVER_PATH, 'covenant_chain/data/capability_registry.json')
        doc = {'source_path': SERVER_PATH}
        self.assertTrue(projection_source_ok(doc))
        self.assertEqual(find_tools({'tools': ['covenant_contract__draft']}), ['covenant_contract__draft'])
        self.assertEqual(find_payments({'methods': [{'id': 'card', 'readiness': 'NOT_CONNECTED'}]})[0]['id'], 'card')


if __name__ == '__main__':
    unittest.main()
