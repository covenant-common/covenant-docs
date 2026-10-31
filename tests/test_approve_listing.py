"""Synthetic owner journeys for the standalone publication signer; no core imports."""
from copy import deepcopy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

CLIENT = Path(__file__).resolve().parents[1] / 'clients' / 'approve_listing.py'
SPEC = importlib.util.spec_from_file_location('listing_signer_under_test', CLIENT)
signer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(signer)
NOW = 1793440000


def wire(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('ascii')


class Terminal(io.StringIO):
    def isatty(self):
        return True


class OwnerJourney(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.access_path, self.preview_path, self.output = (
            self.root / name for name in ('access.json', 'preview.json', 'approval.json'))
        self.key = Ed25519PrivateKey.from_private_bytes(b'\x21' * 32)
        self.actor = self.key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
        self.access = {'version': 'aap-private-trial-client/0.1', 'origin': signer.ORIGIN,
            'actor': self.actor, 'private_seed': '21' * 32, 'token': '43' * 32,
            'client_nonce': '65' * 32, 'challenge': None, 'signature': None,
            'grant': {'status': 'ACTIVE'}}
        source = {'type': 'marketplace-listing', 'id': 'a' * 64}
        item = hashlib.sha256(b'COVENANT-PUBLIC-WEB-ITEM-0.1\0' + wire({
            'origin': signer.ORIGIN, 'kind': 'marketplace', 'source': source})).hexdigest()
        fields = {'title': 'Synthetic test service', 'record_kind': 'LISTING',
            'custom': {'description': 'One fictional deliverable'}, 'want': []}
        self.body = {'version': 'covenant-public-web/0.1', 'origin': signer.ORIGIN,
            'id': item, 'kind': 'marketplace', 'source': source,
            'principals': [self.actor], 'sequence': 1, 'previous': None,
            'visibility': 'INDEXED', 'fields': fields, 'links': [], 'expires': NOW + 3600}
        self.preview = {'id': item, 'body': self.body, 'required_signers': [self.actor],
            'signing_label': 'COVENANT-PUBLIC-WEB-0.1',
            'url': signer.ORIGIN + '/marketplace/' + item, 'available_fields': sorted(fields),
            'preview': {'public_fields': deepcopy(fields),
                'public_metadata': ['origin', 'source hash/type', 'signing identities', 'revision',
                    'visibility', 'expiry', 'explicit links', 'consent signatures'],
                'indexable': True, 'private_source_exported': False, 'boundary': 'Synthetic fixture only.'},
            'execution_authorized': False, 'published': False}
        self.write(self.access_path, self.access)
        self.write(self.preview_path, self.preview)

    def write(self, path, value):
        path.write_bytes(wire(value) + b'\n')
        path.chmod(0o600)

    def phrase(self):
        digest = hashlib.sha256(b'COVENANT-PUBLIC-WEB-0.1\0' + wire(self.body)).hexdigest()
        return 'APPROVE ' + digest[:12] + '\n'

    def approve(self, *, stdin=None, stdout=None):
        output = Terminal() if stdout is None else stdout
        signer.run(self.access_path, self.preview_path, self.output,
            stdin=Terminal(self.phrase()) if stdin is None else stdin, stdout=output, now=NOW)
        return output.getvalue()

    def test_exact_signature_full_review_and_no_secret_output(self):
        displayed = self.approve()
        approval = json.loads(self.output.read_text())
        self.assertEqual(set(approval), {'signer', 'signature'})
        self.assertEqual(approval['signer'], self.actor)
        self.key.public_key().verify(bytes.fromhex(approval['signature']),
            b'COVENANT-PUBLIC-WEB-0.1\0' + wire(self.body))
        self.assertIn(json.dumps(self.body, sort_keys=True, indent=2), displayed)
        self.assertIn('public and searchable', displayed)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)
        for private in (self.access['private_seed'], self.access['token']):
            self.assertNotIn(private, displayed + self.output.read_text())

    def test_bare_native_and_http_result_wrappers(self):
        native = {'version': 'urn:aap:hosted-api:0.1', 'operation': 'listing.prepare',
            'result': self.preview, 'signing_performed': False, 'payment_dispatched': False,
            'external_execution': False}
        for value in (self.preview, native, {'version': 'urn:aap:hosted-api-http:0.1',
                'ok': True, 'result': native}):
            with self.subTest(wrapper=set(value)):
                body, message = signer.checked_listing(value, self.actor, NOW)
                self.assertEqual(message, b'COVENANT-PUBLIC-WEB-0.1\0' + wire(self.body))
                self.assertEqual(body, self.body)
        for value in ({**native, 'operation': 'trade.signing_payload'},
                {**native, 'payment_dispatched': True},
                {'version': 'urn:aap:hosted-api-http:0.1', 'ok': False, 'result': native},
                {'jsonrpc': '2.0', 'id': 1, 'result': self.preview}):
            with self.subTest(refused=set(value)):
                with self.assertRaises(signer.Refused):
                    signer.checked_listing(value, self.actor, NOW)

    def test_wrong_origin_actor_label_kind_and_source_scope(self):
        changes = [lambda p: p['body'].update(origin='https://other.example'),
            lambda p: p.update(signing_label='PAYMENT-APPROVAL'),
            lambda p: p['body'].update(kind='ledger'),
            lambda p: p['body']['source'].update(type='marketplace-order'),
            lambda p: p['body'].update(principals=['b' * 64]),
            lambda p: p.update(required_signers=['b' * 64]),
            lambda p: p.update(id='b' * 64),
            lambda p: p.update(url=signer.ORIGIN + '/marketplace/' + p['id'] + '?other=1'),
            lambda p: p['body']['source'].update(id='c' * 64)]
        for change in changes:
            value = deepcopy(self.preview)
            change(value)
            with self.subTest(change=changes.index(change)):
                with self.assertRaises(signer.Refused):
                    signer.checked_listing(value, self.actor, NOW)

    def test_access_origin_and_seed_actor_mismatch_refuse_before_display(self):
        for change in (lambda a: a.update(origin='https://other.example'),
                lambda a: a.update(actor='b' * 64)):
            access = deepcopy(self.access)
            change(access)
            self.write(self.access_path, access)
            output = Terminal()
            with self.assertRaises(signer.Refused):
                self.approve(stdout=output)
            self.assertEqual(output.getvalue(), '')
            self.assertFalse(self.output.exists())

    def test_tampered_repeated_fields_distinguish_true_and_one(self):
        value = deepcopy(self.preview)
        value['body']['fields']['custom']['n'] = True
        value['preview']['public_fields']['custom']['n'] = 1
        with self.assertRaises(signer.Refused):
            signer.checked_listing(value, self.actor, NOW)
        for name in ('sequence', 'expires'):
            value = deepcopy(self.preview)
            value['body'][name] = True
            with self.assertRaises(signer.Refused):
                signer.checked_listing(value, self.actor, NOW)

    def test_non_ascii_controls_floats_duplicates_and_bounds_refuse(self):
        for raw in (b'{"one":1,"one":2}', b'{"n":1.0}', b'{"n":NaN}',
                b'{"t":"\\u001b[31m"}', b'{"t":"\\n"}', b'{"t":"\\u00e9"}',
                b'{"n":9007199254740992}'):
            with self.subTest(raw=raw):
                with self.assertRaises(signer.Refused):
                    signer.decode(raw)
        value = []
        for unused in range(45):
            value = [value]
        with self.assertRaises(signer.Refused):
            signer.canonical(value)
        self.preview_path.write_bytes(b' ' * 262145)
        with self.assertRaises(signer.Refused):
            self.approve()

    def test_expired_publication_and_unreviewed_fields_refuse(self):
        for change in (lambda p: p['body'].update(expires=NOW),
                lambda p: p['body'].update(unexpected='hidden'),
                lambda p: p['preview']['public_fields'].update(title='Changed title'),
                lambda p: p['body']['fields'].update(record_kind='ORDER')):
            value = deepcopy(self.preview)
            change(value)
            with self.assertRaises(signer.Refused):
                signer.checked_listing(value, self.actor, NOW)

    def test_non_tty_refuses_before_reading_private_file(self):
        for reader, writer in ((io.StringIO(self.phrase()), Terminal()),
                (Terminal(self.phrase()), io.StringIO())):
            with patch.object(signer, 'read_document') as load:
                with self.assertRaises(signer.Refused):
                    self.approve(stdin=reader, stdout=writer)
                load.assert_not_called()

    def test_wrong_confirmation_and_existing_output_never_sign(self):
        with self.assertRaises(signer.Refused):
            self.approve(stdin=Terminal('yes\n'))
        self.assertFalse(self.output.exists())
        self.output.write_text('Keep existing file')
        with self.assertRaises(signer.Refused):
            self.approve()
        self.assertEqual(self.output.read_text(), 'Keep existing file')

    def test_changed_input_during_review_refuses(self):
        outer = self
        class Changed(Terminal):
            def readline(self, size=-1):
                outer.preview_path.write_bytes(outer.preview_path.read_bytes() + b' ')
                return super().readline(size)
        with self.assertRaises(signer.Refused):
            self.approve(stdin=Changed(self.phrase()))
        self.assertFalse(self.output.exists())

    def test_unsafe_input_permissions_symlink_and_hardlink_refuse(self):
        self.access_path.chmod(0o644)
        with self.assertRaises(signer.Refused):
            self.approve()
        self.access_path.chmod(0o600)
        original = self.access_path.with_suffix('.original')
        self.access_path.rename(original)
        self.access_path.symlink_to(original)
        with self.assertRaises(OSError):
            self.approve()
        self.access_path.unlink()
        os.link(original, self.access_path)
        with self.assertRaises(signer.Refused):
            self.approve()

    def test_secret_in_publication_never_reaches_terminal(self):
        self.body['fields']['custom']['description'] = self.access['token'].upper()
        self.preview['preview']['public_fields'] = deepcopy(self.body['fields'])
        self.write(self.preview_path, self.preview)
        output = Terminal()
        with self.assertRaisesRegex(signer.Refused, 'SECRET_IN_PUBLICATION'):
            self.approve(stdout=output)
        self.assertEqual(output.getvalue(), '')
        self.assertFalse(self.output.exists())

    def test_cli_non_tty_error_never_prints_supplied_secrets(self):
        result = subprocess.run([sys.executable, '-I', str(CLIENT), '--access', str(self.access_path),
            '--preview', str(self.preview_path), '--output', str(self.output)],
            input=self.phrase(), text=True, capture_output=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn('OWNER_TERMINAL_REQUIRED', result.stderr)
        for private in (self.access['token'], self.access['private_seed']):
            self.assertNotIn(private, result.stdout + result.stderr)
        bad = subprocess.run([sys.executable, '-I', str(CLIENT), '--token', self.access['token']],
            text=True, capture_output=True)
        self.assertEqual(bad.returncode, 1)
        self.assertNotIn(self.access['token'], bad.stdout + bad.stderr)


if __name__ == '__main__':
    unittest.main()
