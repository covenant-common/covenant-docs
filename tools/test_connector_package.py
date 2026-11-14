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
import build_live_engine_discovery as engine

SPEC = importlib.util.spec_from_file_location('connector_package', Path(__file__).with_name('build_connector_package.py'))
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class PublicConnectorPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.plugin = self.root / 'plugin'
        shutil.copytree(PACKAGE.PLUGIN, self.plugin)
        self.retained = {}
        for archive, digest in PACKAGE.RETAINED_ARCHIVES.items():
            copy = self.root / archive.name
            copy.write_bytes(archive.read_bytes())
            self.retained[copy] = digest
        self.patches = [patch.object(PACKAGE, 'PLUGIN', self.plugin),
                        patch.object(PACKAGE, 'RETAINED_ARCHIVES', self.retained)]
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
        before = {archive: archive.read_bytes() for archive in self.retained}
        archive = PACKAGE.build()
        self.assertEqual(archive, PACKAGE.build())
        for retained, expected in self.retained.items():
            self.assertEqual(retained.read_bytes(), before[retained])
            self.assertEqual(hashlib.sha256(before[retained]).hexdigest(), expected)
        with zipfile.ZipFile(io.BytesIO(archive)) as z:
            self.assertEqual(z.namelist(), list(PACKAGE.FILES))
            for name in PACKAGE.FILES:
                self.assertEqual(z.read(name), (self.plugin / name).read_bytes())
                self.assertEqual(z.getinfo(name).date_time, PACKAGE.ARCHIVE_DATE)
            for name in ('plugin.json', '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json'):
                manifest = json.loads(z.read(name))
                self.assertEqual((manifest['name'], manifest['version'], manifest['license']),
                                 ('covenant-public', '0.2.0', 'MIT'))
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
        for archive in self.retained:
            with self.subTest(archive=archive.name):
                original = archive.read_bytes()
                archive.write_bytes(b'replaced')
                try:
                    with self.assertRaisesRegex(ValueError, 'archive.*must remain byte-exact'):
                        PACKAGE.build()
                finally:
                    archive.write_bytes(original)

    def test_recording_placeholder_is_not_accepted(self):
        self.change_manifest(lambda x: x['extensions']['com.openai']['review'].update({'demo_recording_url': ''}))
        with self.assertRaisesRegex(ValueError, 'recording URL'):
            PACKAGE.build()


class CurrentReviewerCases(unittest.TestCase):
    def test_public_package_and_cases_match_review_pinned_live_inventory(self):
        profile = engine.reviewed_profile(engine.SUCCESSOR_VERSION)
        source = engine.validate(json.loads(profile.observation.read_bytes()), profile.version)
        schemas = {tool['name']: tool['inputSchema'] for tool in source['tools']}
        self.assertEqual(set(schemas), PACKAGE.PUBLIC_TOOLS)
        self.assertEqual(source['endpoint'], PACKAGE.ENDPOINT)
        root = PACKAGE.ROOT
        manifest = json.loads((PACKAGE.PLUGIN / 'plugin.json').read_bytes())
        cases = json.loads((root / 'distribution/engine-connector-review-0.2.0.json').read_bytes())
        self.assertEqual(cases['format'], 'aap-public-connector-review/' + PACKAGE.VERSION)
        self.assertEqual(cases['endpoint'], source['endpoint'])
        self.assertEqual(cases['protocolVersion'], source['protocolVersion'])
        self.assertEqual((root / cases['observation']).read_bytes(), profile.observation.read_bytes())
        self.assertEqual(cases['inventory'], profile.inventory)
        active = engine.reviewed_profile(engine.ACTIVE_VERSION)
        active_source = engine.validate(json.loads(active.observation.read_bytes()), active.version)
        active_outputs = engine.documents(active_source, active.version)
        self.assertEqual(active_outputs[active.inventory][1], (root / 'mcp/tool-inventory.json').read_bytes())
        for compatibility_field in ('endpoint', 'protocolVersion', 'tools'):
            self.assertEqual(source[compatibility_field], active_source[compatibility_field])
        help_text = (root / 'docs/CONNECTORS.html').read_text()
        self.assertIn('id="refresh"', help_text)
        for label, rows in cases['test_cases'].items():
            published = manifest['extensions']['com.openai']['review']['test_cases'][label]
            self.assertEqual(len(rows), len(published))
            for row, case in zip(rows, published):
                with self.subTest(case=row['id']):
                    self.assertEqual(row['prompt'], case['prompt'])
                    self.assertEqual(row['description'], case['description'])
                    names = {step['request']['name'] for step in row['steps']}
                    self.assertEqual(names, set(case['tools_triggered'].split(', ')))
                    for step in row['steps']:
                        request = step['request']
                        outer = schemas[request['name']]
                        branches = outer.get('oneOf', [outer])
                        self.assertEqual(sum(object_matches(request['arguments'], branch)
                                             for branch in branches), 1)
                        expectations = step['expect']
                        if label == 'negative':
                            self.assertEqual(expectations['status'], 'REFUSED')
                            self.assertFalse(expectations['execution_authorized'])


def object_matches(data, schema):
    # The four reviewed entry schemas use closed object branches with primitive fields.
    props = schema['properties']
    if (schema['type'] != 'object' or schema.get('additionalProperties') is not False
            or not set(schema['required']) <= data.keys() <= props.keys()):
        return False
    primitive_types = {'string': str, 'integer': int, 'boolean': bool, 'object': dict}
    for name, value in data.items():
        field = props[name]
        if 'const' in field and value != field['const']:
            return False
        if 'enum' in field and value not in field['enum']:
            return False
        kind = field.get('type')
        if kind and type(value) is not primitive_types[kind]:
            return False
        if isinstance(value, str) and ('minLength' in field or 'maxLength' in field):
            if not field.get('minLength', 0) <= len(value) <= field.get('maxLength', len(value)):
                return False
        if 'minimum' in field and value < field['minimum']:
            return False
        if 'maximum' in field and value > field['maximum']:
            return False
    return True


if __name__ == '__main__':
    unittest.main()
