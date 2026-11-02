"""Offline archive and public-scope regression checks for the connector release."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SPEC = importlib.util.spec_from_file_location('connector_package', Path(__file__).with_name('build_connector_package.py'))
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class PublicConnectorPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.plugin = self.root / 'plugin'
        shutil.copytree(PACKAGE.PLUGIN, self.plugin)
        self.legacy = self.root / 'covenant-public-0.1.0.zip'
        self.legacy.write_bytes(PACKAGE.LEGACY_OUTPUT.read_bytes())
        self.patches = [patch.object(PACKAGE, 'PLUGIN', self.plugin),
                        patch.object(PACKAGE, 'LEGACY_OUTPUT', self.legacy)]
        for p in self.patches:
            p.start()
        self.addCleanup(self.temp.cleanup)
        for p in self.patches:
            self.addCleanup(p.stop)

    def change_manifest(self, mutate):
        p = self.plugin / 'plugin.json'
        value = json.loads(p.read_text())
        mutate(value)
        p.write_text(json.dumps(value))

    def test_archive_is_deterministic_public_allowlist_with_matching_identities(self):
        before = self.legacy.read_bytes()
        archive = PACKAGE.build()
        self.assertEqual(archive, PACKAGE.build())
        self.assertEqual(before, self.legacy.read_bytes())
        self.assertEqual(hashlib.sha256(before).hexdigest(), PACKAGE.LEGACY_SHA256)
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            self.assertEqual(z.namelist(), list(PACKAGE.FILES))
            for name in PACKAGE.FILES:
                self.assertEqual(z.read(name), (self.plugin / name).read_bytes())
                self.assertEqual(z.getinfo(name).date_time, (2026, 11, 2, 0, 0, 0))
            for name in ('plugin.json', '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json'):
                manifest = json.loads(z.read(name))
                self.assertEqual((manifest['name'], manifest['version'], manifest['license']),
                                 ('covenant-public', '0.1.1', 'MIT'))
            portable = json.loads(z.read('mcp.json'))
            native = json.loads(z.read('.mcp.json'))
            self.assertEqual(portable['mcpServers']['covenant-public'],
                             {'type': 'streamable-http', 'url': PACKAGE.ENDPOINT})
            self.assertEqual(native['mcpServers']['covenant-public'],
                             {'type': 'http', 'url': PACKAGE.ENDPOINT})

    def test_extra_source_or_private_record_cannot_enter_archive(self):
        (self.plugin / 'private-engine.py').write_text('pass\n')
        with self.assertRaisesRegex(ValueError, 'allowlist'):
            PACKAGE.build()

    def test_symlink_cannot_substitute_a_reviewed_member(self):
        target = self.root / 'outside.md'
        target.write_text('Outside content')
        p = self.plugin / 'README.md'
        p.unlink()
        p.symlink_to(target)
        with self.assertRaisesRegex(ValueError, 'Symlinks'):
            PACKAGE.build()

    def test_private_account_endpoint_is_rejected(self):
        p = self.plugin / '.mcp.json'
        value = json.loads(p.read_text())
        value['mcpServers']['covenant-public']['url'] += '/account/v1'
        p.write_text(json.dumps(value))
        with self.assertRaises(ValueError):
            PACKAGE.build()

    def test_authentication_header_cannot_enter_anonymous_wrapper(self):
        p = self.plugin / 'mcp.json'
        value = json.loads(p.read_text())
        value['mcpServers']['covenant-public']['headers'] = {'Authorization': 'example'}
        p.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'anonymous HTTPS endpoint'):
            PACKAGE.build()

    def test_credentials_and_fingerprints_are_rejected_without_echoing_values(self):
        p = self.plugin / 'README.md'
        original = p.read_text()
        for marker in ('-----BEGIN PRIVATE KEY-----', 'sk-proj-testvalue1234567890', 'ab' * 32):
            with self.subTest(marker_type=marker[:8]):
                p.write_text(original + '\n' + marker)
                with self.assertRaisesRegex(ValueError, 'Potential credential') as caught:
                    PACKAGE.build()
                self.assertNotIn(marker, str(caught.exception))
        p.write_text(original)

    def test_private_reviewer_credentials_stay_out_of_manifest(self):
        self.change_manifest(lambda x: x['extensions']['com.openai']['review'].update(
            {'test_credentials': 'dedicated reviewer access belongs in the secure portal'}))
        with self.assertRaisesRegex(ValueError, 'private reviewer access'):
            PACKAGE.build()

    def test_native_hooks_cannot_add_executable_behavior(self):
        p = self.plugin / '.claude-plugin/plugin.json'
        value = json.loads(p.read_text())
        value['hooks'] = {'command': 'unexpected-local-command'}
        p.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, 'configuration-only public metadata'):
            PACKAGE.build()

    def test_initial_review_case_counts_are_required(self):
        self.change_manifest(lambda x: x['extensions']['com.openai']['review']['test_cases']['negative'].pop())
        with self.assertRaisesRegex(ValueError, 'exactly five positive and three negative'):
            PACKAGE.build()

    def test_account_tool_is_rejected_from_public_review_cases(self):
        self.change_manifest(lambda x: x['extensions']['com.openai']['review']['test_cases']['positive'][0].update(
            {'tools_triggered': 'covenant_account__publish'}))
        with self.assertRaisesRegex(ValueError, 'non-public'):
            PACKAGE.build()

    def test_previous_archive_cannot_be_replaced_silently(self):
        self.legacy.write_bytes(b'replaced')
        with self.assertRaisesRegex(ValueError, '0.1.0 archive must remain byte-exact'):
            PACKAGE.build()

    def test_recording_placeholder_is_not_accepted(self):
        self.change_manifest(lambda x: x['extensions']['com.openai']['review'].update({'demo_recording_url': ''}))
        with self.assertRaisesRegex(ValueError, 'recording URL'):
            PACKAGE.build()


if __name__ == '__main__':
    unittest.main()
