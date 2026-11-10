"""Memory-only publication approval journeys with synthetic terminal input.

The non-POSIX case mocks platform selection; it is not native Windows proof.
No network, account, real credential or publication is used.
"""
from copy import deepcopy
import builtins
import hashlib
import importlib.util
import io
import json
import socket
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('paste_listing_signer', ROOT / 'clients' / 'approve_listing.py')
signer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(signer)
FIXTURE = json.loads((ROOT / 'tests' / 'fixtures' / 'advert-draft-v01.json').read_text())
NOW = 1793440000
SEED = '21' * 32


def wire(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('ascii')


class Terminal(io.StringIO):
    def isatty(self):
        return True


class PasteApprovalJourney(unittest.TestCase):
    def setUp(self):
        self.preview = deepcopy(FIXTURE['prepared'])
        self.body = self.preview['body']
        self.message = b'COVENANT-PUBLIC-WEB-0.1\0' + wire(self.body)
        self.key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(SEED))
        self.stdout, self.stderr = Terminal(), Terminal()

    def phrase(self):
        return 'APPROVE ' + hashlib.sha256(self.message).hexdigest()[:12]

    def pasted(self, value=None, *, confirmation=None, raw=None):
        if raw is None:
            raw = json.dumps(self.preview if value is None else value, indent=2) + '\n'
        return Terminal(raw + 'END PREVIEW\n' +
            (self.phrase() if confirmation is None else confirmation) + '\n')

    def approve(self, *, stdin=None, stdout=None, stderr=None, reader=None, now=NOW):
        return signer.run_paste(stdin=self.pasted() if stdin is None else stdin,
            stdout=self.stdout if stdout is None else stdout,
            stderr=self.stderr if stderr is None else stderr,
            secret_reader=Mock(return_value=SEED) if reader is None else reader, now=now)

    def assert_no_approval(self):
        self.assertNotIn('APPROVAL JSON', self.stdout.getvalue())
        self.assertNotIn(FIXTURE['expected_signature'], self.stdout.getvalue())

    def test_exact_signature_covers_all_displayed_body_fields_without_file_access(self):
        with patch.object(builtins, 'open', side_effect=AssertionError('paste must not open files')), \
             patch.object(io, 'open', side_effect=AssertionError('paste must not open paths')), \
             patch.object(socket, 'socket', side_effect=AssertionError('paste must stay offline')), \
             patch.object(signer.os, 'open', side_effect=AssertionError('paste must not open descriptors')), \
             patch.object(signer, 'read_document', side_effect=AssertionError('no credential file')), \
             patch.object(signer, 'new_output', side_effect=AssertionError('no approval file')):
            approval = self.approve()
        self.assertEqual(set(approval), {'signer', 'signature'})
        self.assertEqual(approval['signer'], self.body['principals'][0])
        self.key.public_key().verify(bytes.fromhex(approval['signature']), self.message)
        self.assertEqual(approval['signature'], FIXTURE['expected_signature'])
        displayed = self.stdout.getvalue()
        self.assertIn(json.dumps(self.body, sort_keys=True, indent=2), displayed)
        self.assertIn(wire(approval).decode(), displayed)
        self.assertIn('public and searchable', displayed)
        self.assertIn('No file was saved', displayed)
        self.assertNotIn(SEED, displayed + self.stderr.getvalue())

    def test_preview_warning_is_displayed_before_the_first_input_read(self):
        owner = self
        class ObservedInput(Terminal):
            first_read = True
            def readline(self, size=-1):
                if self.first_read:
                    displayed = owner.stdout.getvalue()
                    owner.assertIn('Paste only prepared public advert data', displayed)
                    owner.assertIn('displayed locally', displayed)
                    owner.assertIn('Never paste a private key here', displayed)
                    owner.assertIn('separate hidden prompt', displayed)
                    self.first_read = False
                return super().readline(size)
        stream = ObservedInput(self.pasted().getvalue())
        self.approve(stdin=stream)
        self.assertFalse(stream.first_read)

    def test_caller_pasted_seed_is_refused_before_signing_without_claiming_prior_redaction(self):
        # Legacy prepared shape permits independent synthetic selected fields.
        # The caller already supplied this value in ordinary echoed preview input.
        prepared = {name: value for name, value in self.preview.items()
            if name not in ('source', 'draft_profile')}
        self.body['fields']['title'] = 'Synthetic caller-pasted value ' + SEED
        prepared['preview']['public_fields'] = deepcopy(self.body['fields'])
        self.message = b'COVENANT-PUBLIC-WEB-0.1\0' + wire(self.body)
        signing_key = Mock(wraps=self.key)
        factory = Mock()
        factory.from_private_bytes.return_value = signing_key
        reader = Mock(return_value=SEED)
        with patch.object(signer, 'Ed25519PrivateKey', factory), \
             self.assertRaisesRegex(signer.Refused, '^SECRET_IN_PUBLICATION$'):
            self.approve(stdin=self.pasted(prepared), reader=reader)
        reader.assert_called_once()
        signing_key.sign.assert_not_called()
        self.assert_no_approval()
        # This is a documented display residual, not a leak from hidden input.
        self.assertIn(SEED, self.stdout.getvalue())

    def test_confirmation_is_complete_before_hidden_seed_prompt(self):
        stream = self.pasted()
        def hidden(prompt, *, stream):
            displayed = self.stdout.getvalue()
            self.assertIn('hidden', prompt)
            self.assertIs(stream, self.stderr)
            self.assertIn(json.dumps(self.body, sort_keys=True, indent=2), displayed)
            self.assertIn('Type exactly: ' + self.phrase(), displayed)
            self.assertEqual(input_stream.read(), '')
            self.assert_no_approval()
            return SEED
        input_stream = stream
        self.approve(stdin=input_stream, reader=hidden)

    def test_legacy_native_and_http_wrappers_sign_identical_body(self):
        native = {'version': 'urn:aap:hosted-api:0.1', 'operation': 'listing.prepare',
            'result': self.preview, 'signing_performed': False, 'payment_dispatched': False,
            'external_execution': False}
        legacy = {name: value for name, value in self.preview.items()
            if name not in ('source', 'draft_profile')}
        for prepared in (self.preview, legacy, native,
                {'version': 'urn:aap:hosted-api-http:0.1', 'ok': True, 'result': native}):
            with self.subTest(wrapper=set(prepared)):
                result = self.approve(stdin=self.pasted(prepared))
                self.assertEqual(result['signature'], FIXTURE['expected_signature'])

    def test_each_redirected_stream_refuses_before_json_or_private_seed_is_read(self):
        for redirected in ('stdin', 'stdout', 'stderr'):
            with self.subTest(redirected=redirected):
                streams = dict(stdin=self.pasted(), stdout=Terminal(), stderr=Terminal())
                streams[redirected] = io.StringIO()
                streams['stdin'].readline = Mock(side_effect=AssertionError('must refuse before reading'))
                reader = Mock(side_effect=AssertionError('must not request a private seed'))
                with self.assertRaisesRegex(signer.Refused, '^OWNER_TERMINAL_REQUIRED$'):
                    self.approve(**streams, reader=reader)
                streams['stdin'].readline.assert_not_called()
                reader.assert_not_called()

    def test_rejected_confirmation_never_prompts_for_private_seed(self):
        for phrase in ('yes', '', self.phrase().lower()):
            with self.subTest(confirmation=phrase):
                reader = Mock()
                with self.assertRaisesRegex(signer.Refused, '^APPROVAL_NOT_GIVEN$'):
                    self.approve(stdin=self.pasted(confirmation=phrase), reader=reader)
                reader.assert_not_called()
                self.assert_no_approval()

    def test_malformed_or_mismatched_seed_returns_no_approval(self):
        for seed, code in (('', 'PRIVATE_SEED_FORMAT'), ('not a seed', 'PRIVATE_SEED_FORMAT'),
                ('21' * 31, 'PRIVATE_SEED_FORMAT'), ('22' * 32, 'ACCESS_ACTOR_MISMATCH')):
            with self.subTest(code=code):
                with self.assertRaisesRegex(signer.Refused, '^' + code + '$'):
                    self.approve(reader=Mock(return_value=seed))
                self.assert_no_approval()
                if seed:
                    self.assertNotIn(seed, self.stdout.getvalue())

    def test_malformed_json_and_incomplete_paste_never_prompt_for_seed(self):
        for raw, code in (('{', 'JSON_INVALID'), ('{"a":1,"a":2}', 'JSON_DUPLICATE_KEY'),
                ('{"a":1.0}', 'JSON_NUMBER'), ('{"a":NaN}', 'JSON_NUMBER')):
            with self.subTest(code=code):
                reader = Mock()
                with self.assertRaisesRegex(signer.Refused, '^' + code + '$'):
                    self.approve(stdin=self.pasted(raw=raw + '\n'), reader=reader)
                reader.assert_not_called()
        reader = Mock()
        with self.assertRaisesRegex(signer.Refused, '^PREVIEW_INCOMPLETE$'):
            self.approve(stdin=Terminal(json.dumps(self.preview) + '\n'), reader=reader)
        reader.assert_not_called()
        self.assert_no_approval()

    def test_over_limit_preview_refuses_without_key_prompt(self):
        raw = wire(self.preview).decode()
        padded = raw + ' ' * (262145 - len(raw) - 1) + '\n'
        self.assertEqual(len(padded.encode()), 262145)
        reader = Mock()
        with self.assertRaisesRegex(signer.Refused, '^PUBLICATION_SIZE$'):
            self.approve(stdin=self.pasted(raw=padded), reader=reader)
        reader.assert_not_called()
        self.assert_no_approval()

    def test_preview_at_inclusive_byte_limit_still_accepts_the_terminator(self):
        raw = wire(self.preview).decode()
        for ending in ('\n', '\r\n'):
            with self.subTest(line_ending=repr(ending)):
                padded = raw + ' ' * (262144 - len(raw) - len(ending)) + ending
                self.assertEqual(len(padded.encode()), 262144)
                stream = Terminal(padded + 'END PREVIEW' + ending + self.phrase() + ending)
                approval = self.approve(stdin=stream)
                self.assertEqual(approval['signature'], FIXTURE['expected_signature'])

    def test_publication_expired_before_review_never_prompts_for_seed(self):
        reader = Mock()
        with self.assertRaisesRegex(signer.Refused, '^PUBLICATION_EXPIRED$'):
            self.approve(now=self.body['expires'], reader=reader)
        reader.assert_not_called()
        self.assert_no_approval()

    def test_expiry_after_review_is_rechecked_before_signature_output(self):
        reader = Mock(return_value=SEED)
        signing_key = Mock(wraps=self.key)
        factory = Mock()
        factory.from_private_bytes.return_value = signing_key
        with patch.object(signer.time, 'time', side_effect=[NOW, self.body['expires']]), \
             patch.object(signer, 'Ed25519PrivateKey', factory), \
             self.assertRaisesRegex(signer.Refused, '^PUBLICATION_EXPIRED$'):
            self.approve(now=None, reader=reader)
        reader.assert_called_once()
        signing_key.sign.assert_not_called()
        self.assert_no_approval()

    def test_getpass_echo_fallback_refuses_before_seed_read_or_signing(self):
        # Exercise the stdlib fallback's real warning before its input reader.
        with patch.object(signer.getpass, 'getpass', side_effect=signer.getpass.fallback_getpass), \
             patch.object(signer.getpass, '_raw_input') as seed_input, \
             patch.object(signer, 'Ed25519PrivateKey') as key_factory, \
             self.assertRaisesRegex(signer.Refused, '^HIDDEN_INPUT_UNAVAILABLE$'):
            signer.run_paste(stdin=self.pasted(), stdout=self.stdout, stderr=self.stderr, now=NOW)
        seed_input.assert_not_called()
        key_factory.from_private_bytes.assert_not_called()
        self.assert_no_approval()
        self.assertNotIn(SEED, self.stdout.getvalue() + self.stderr.getvalue())

    def test_memory_only_route_does_not_require_posix_platform(self):
        # Mocked platform branch only; native Windows console/getpass is untested.
        with patch.object(signer.os, 'name', 'nt'), \
             patch.object(signer, 'open_parent', side_effect=AssertionError('POSIX helper must not run')):
            approval = self.approve(stdin=Terminal(self.pasted().getvalue().replace('\n', '\r\n')))
        self.key.public_key().verify(bytes.fromhex(approval['signature']), self.message)

    def test_cli_paste_dispatch_and_file_mode_exclusion_are_explicit(self):
        with patch.object(signer.sys, 'argv', ['approve_listing.py', '--paste']), \
             patch.object(signer, 'run_paste') as pasted, patch.object(signer, 'run') as file_mode:
            signer.main()
            pasted.assert_called_once_with(stdin=signer.sys.stdin,
                stdout=signer.sys.stdout, stderr=signer.sys.stderr)
            file_mode.assert_not_called()
        for option in ('--access', '--preview', '--output'):
            with self.subTest(option=option), \
                 patch.object(signer.sys, 'argv', ['approve_listing.py', '--paste', option, 'unused.json']), \
                 patch.object(signer, 'run_paste') as pasted:
                with self.assertRaisesRegex(signer.Refused, '^ARGUMENTS$'):
                    signer.main()
                pasted.assert_not_called()


if __name__ == '__main__':
    unittest.main()
