"""Standalone PR188 envelope conformance. Synthetic public fixture, no engine import."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('candidate_listing_signer', ROOT / 'clients' / 'approve_listing.py')
signer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(signer)
FIXTURE = json.loads((ROOT / 'tests' / 'fixtures' / 'advert-draft-v01.json').read_text())
NOW = 1793440000
ACTOR = FIXTURE['prepared']['required_signers'][0]


class AdvertProfileConformance(unittest.TestCase):
    def test_augmented_and_legacy_bodies_have_exact_same_bytes_and_signature(self):
        augmented = FIXTURE['prepared']
        legacy = {name: value for name, value in augmented.items()
                  if name not in ('source', 'draft_profile')}
        for prepared in (augmented, legacy):
            body, message = signer.checked_listing(prepared, ACTOR, NOW)
            self.assertEqual(signer.canonical(body).decode(), FIXTURE['expected_canonical_body'])
            self.assertEqual(message.hex(), FIXTURE['expected_message_hex'])
            self.assertEqual(Ed25519PrivateKey.from_private_bytes(bytes.fromhex('21' * 32)).sign(message).hex(),
                             FIXTURE['expected_signature'])

    def test_native_and_http_augmented_receipts_are_accepted(self):
        native = {'version': 'urn:aap:hosted-api:0.1', 'operation': 'listing.prepare',
                  'result': FIXTURE['prepared'], 'signing_performed': False,
                  'payment_dispatched': False, 'external_execution': False}
        for prepared in (native, {'version': 'urn:aap:hosted-api-http:0.1', 'ok': True, 'result': native}):
            self.assertEqual(signer.checked_listing(prepared, ACTOR, NOW)[1].hex(), FIXTURE['expected_message_hex'])

    def test_unknown_or_partial_augmented_shape_is_refused(self):
        for change in (lambda p: p.pop('draft_profile'), lambda p: p.pop('source'),
                       lambda p: p.update(draft_profile='urn:aap:hosted-advert-draft:future'),
                       lambda p: p.update(extra='unexpected'),
                       lambda p: p['source'].update(extra='unexpected')):
            value = deepcopy(FIXTURE['prepared']); change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_listing(value, ACTOR, NOW)

    def test_source_hash_author_and_selected_fields_are_bound(self):
        for change in (lambda p: p['source'].update(author='b' * 64),
                       lambda p: p['source'].update(title='Changed source'),
                       lambda p: p['source']['data'].update(market='b' * 64),
                       lambda p: p['available_fields'].remove('archetype')):
            value = deepcopy(FIXTURE['prepared']); change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_listing(value, ACTOR, NOW)
        value = deepcopy(FIXTURE['prepared'])
        value['body']['fields']['title'] = value['preview']['public_fields']['title'] = 'Unbound selected title'
        with self.assertRaisesRegex(signer.Refused, 'ADVERT_SOURCE_PROJECTION'):
            signer.checked_listing(value, ACTOR, NOW)


if __name__ == '__main__':
    unittest.main()
