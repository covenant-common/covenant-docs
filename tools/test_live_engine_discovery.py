"""Offline checks for the observed live successor and preserved earlier profile."""
from copy import deepcopy
import contextlib
import hashlib
from io import BytesIO, StringIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_live_engine_discovery as engine
import build_public_discovery as legacy
from public_discovery_wsgi import PublicDiscoveryWSGI


class LiveEngineDiscovery(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(engine.SOURCE.read_text())

    def test_exact_observed_schemas_card_identity_and_hashes_agree(self):
        original = deepcopy(self.source)
        output = engine.documents(self.source)
        inventory = json.loads(output[engine.INVENTORY][1])
        card = json.loads(output['mcp/server-card'][1])
        self.assertEqual(self.source, original)
        self.assertEqual(inventory['tools'], original['tools'])
        self.assertEqual(inventory['toolCount'], 4)
        self.assertEqual(output['mcp/tool-inventory.json'], output[engine.INVENTORY])
        self.assertEqual(output['mcp/server-card'], output['.well-known/mcp/server-card.json'])
        self.assertEqual(card['_meta']['io.github.covenant-common/aap'],
                         original['serverCard']['_meta']['io.github.covenant-common/aap'])
        snapshot = card['_meta']['io.github.covenant-common/public-tools']
        self.assertEqual(snapshot['sha256'], hashlib.sha256(output[engine.INVENTORY][1]).hexdigest())
        self.assertEqual(snapshot['url'], engine.WEBSITE + '/' + engine.INVENTORY)
        self.assertEqual(card['remotes'][0]['url'], engine.ENDPOINT)
        self.assertEqual(inventory['serverInfo'], {'name': 'aap-engine', 'version': '0.1'})
        self.assertFalse(inventory['tools'][-1]['annotations']['readOnlyHint'])

    def test_schema_card_catalogue_and_identity_drift_require_review(self):
        cases = []
        missing = deepcopy(self.source); missing['tools'].pop(); cases.append(missing)
        write = deepcopy(self.source); write['tools'][-1]['annotations']['readOnlyHint'] = True; cases.append(write)
        schema = deepcopy(self.source); schema['tools'][1]['inputSchema']['properties'].pop('kind'); cases.append(schema)
        card = deepcopy(self.source); card['serverCard']['remotes'][0]['url'] += '/other'; cases.append(card)
        access = deepcopy(self.source); access['engine']['account_authentication'] = 'NONE'; cases.append(access)
        counts = deepcopy(self.source); counts['engine']['catalogue']['maintained_families'] = 999; cases.append(counts)
        identity = deepcopy(self.source); identity['serverInfo']['name'] = 'other'; cases.append(identity)
        for index, case in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(ValueError):
                engine.documents(case)

    def test_historical_nine_files_reproduce_exact_archived_bytes(self):
        old = legacy.documents(json.loads(legacy.SOURCE.read_text()))
        for path, (_media, body) in old.items():
            with self.subTest(path=path):
                self.assertEqual((engine.HISTORY / path).read_bytes(), body)
        inventory = json.loads(old['mcp/tool-inventory.json'][1])
        self.assertEqual(inventory['toolCount'], 9)
        self.assertNotEqual(old['mcp/server-card'][1], engine.documents(self.source)['mcp/server-card'][1])

    def test_refresh_is_exactly_three_anonymous_discovery_requests_without_redirects(self):
        calls = []
        source = self.source
        class Response:
            status = 200
            def __init__(self, url, value): self.url, self.value = url, value
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def geturl(self): return self.url
            def read(self, bound):
                self_outer.assertEqual(bound, 262145)
                return engine.wire(self.value)
        class Opener:
            def open(self, request, timeout):
                self_outer.assertFalse(any(k.lower() == 'authorization' for k in request.headers))
                packet = json.loads(request.data) if request.data else None
                calls.append((request.method, request.full_url, None if packet is None else packet['method']))
                if packet is None:
                    value = source['serverCard']
                else:
                    value = {'jsonrpc': '2.0', 'id': packet['id'], 'result': (
                        {'protocolVersion': source['protocolVersion'], 'serverInfo': source['serverInfo']}
                        if packet['method'] == 'initialize' else {'tools': source['tools']})}
                return Response(request.full_url, value)
        self_outer = self
        def opener(handler):
            self.assertIsNone(handler.redirect_request(None, None, 302, '', {}, 'http://127.0.0.1/private'))
            return Opener()
        with patch.object(engine, 'build_opener', side_effect=opener):
            observed = engine.observe()
        self.assertEqual(calls, [('GET', engine.ORIGIN + '/.well-known/mcp/server-card.json', None),
                                 ('POST', engine.ENDPOINT, 'initialize'),
                                 ('POST', engine.ENDPOINT, 'tools/list')])
        for field in ('tools', 'serverInfo', 'engine', 'serverCard', 'protocolVersion'):
            self.assertEqual(observed[field], source[field])
        self.assertFalse(observed['sourceEvidence']['runtimeCommitVerifiedByThisCapture'])

    def test_six_host_documents_exclude_website_only_versioned_inventory(self):
        profile = engine.reviewed_profile(engine.ACTIVE_VERSION)
        source = json.loads(profile.observation.read_text())
        manifest = json.loads((engine.ROOT / 'distribution/public-discovery-deployment.json').read_text())
        self.assertEqual(len(manifest['documents']), 6)
        self.assertEqual(manifest['websiteOnlyDocuments'], [profile.inventory])
        self.assertEqual(manifest['hostedEngineStatus'], 'OBSERVED_LIVE')
        self.assertEqual(manifest['staticWebsiteStatus'], 'PREPARED_FOR_PUBLICATION')
        self.assertEqual(manifest['profile'], profile.profile)
        output = engine.documents(source, profile.version)
        records = {row['path']: (row['contentType'], output[row['file']][1]) for row in manifest['documents']}
        delegated = []
        sentinel = [b'unchanged engine response']
        env = {'PATH_INFO': '/mcp/engine/v1', 'REQUEST_METHOD': 'POST',
               'HTTP_AUTHORIZATION': 'synthetic-test-only', 'wsgi.input': BytesIO(b'original body')}
        start = lambda *_args: None
        def application(actual, callback):
            delegated.append((actual, callback))
            self.assertIs(actual['wsgi.input'], env['wsgi.input'])
            self.assertEqual(actual['wsgi.input'].read(), b'original body')
            return sentinel
        wrapper = PublicDiscoveryWSGI(application, records)
        self.assertIs(wrapper(env, start), sentinel)
        self.assertEqual(delegated, [(env, start)])

    def test_refresh_rebuilds_aliases_without_overwriting_versioned_observation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            retained = root / 'distribution' / engine.SOURCE.name
            retained.parent.mkdir()
            retained.write_bytes(engine.wire(self.source))
            original = retained.read_bytes()
            current = deepcopy(self.source)
            current['observedAt'] = '2099-01-01T00:00:00Z'
            with patch.object(legacy, 'ROOT', root), patch.object(engine, 'SOURCE', retained), \
                    patch.object(engine, 'observe', return_value=current), \
                    patch('sys.argv', ['build_public_discovery.py', '--profile', engine.VERSION, '--refresh']), \
                    contextlib.redirect_stdout(StringIO()):
                legacy.main()
            self.assertEqual(retained.read_bytes(), original)
            published = json.loads((root / 'mcp/tool-inventory.json').read_text())
            self.assertEqual(published['observedAt'], self.source['observedAt'])


class FutureEngineDiscovery(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(engine.SOURCE.read_text())
        self.source['format'] = 'aap-hosted-engine-observation/' + engine.SUCCESSOR_VERSION
        self.source['profile'] = 'urn:aap:hosted-engine-mcp:0.2'
        self.source['serverInfo']['version'] = '0.2'
        # These are isolated test transport values, not a deployment claim.
        card = self.source['serverCard']
        card['version'] = '0.2'
        meta = card['_meta'][engine.META]
        meta.update(serverInfo=deepcopy(self.source['serverInfo']), profile=self.source['profile'],
                    keyless_actions=159)
        self.source['engine'].update(profile=self.source['profile'], keyless_actions=159)
        self.source['sourceEvidence'] = {'runtimeCommitVerifiedByThisCapture': False}
        self.pins = {**engine.review_pins(self.source),
                     'observation': hashlib.sha256(engine.wire(self.source)).hexdigest()}

    def test_unpinned_upgrade_cannot_read_network_or_generate_output(self):
        with patch.object(engine, 'SUCCESSOR_PINS', None), \
                patch.object(engine, 'build_opener', side_effect=AssertionError('network')), \
                patch('sys.argv', ['build_public_discovery.py', '--profile',
                                   engine.SUCCESSOR_VERSION, '--refresh']):
            with self.assertRaisesRegex(SystemExit, 'awaiting explicit review pins'):
                legacy.main()
            with self.assertRaisesRegex(ValueError, 'awaiting explicit review pins'):
                engine.documents(self.source, engine.SUCCESSOR_VERSION)

    def test_new_capture_writes_only_exclusive_external_file_and_does_not_select_profile(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(engine, 'SUCCESSOR_PINS', None), \
                patch.object(engine, '_capture', return_value=self.source) as capture:
            path = Path(directory) / 'observation.json'
            result = engine.capture_successor_for_review(path)
            self.assertEqual(json.loads(path.read_text()), self.source)
            self.assertEqual(result['status'], 'CAPTURED_FOR_REVIEW')
            self.assertEqual(result['candidatePins'], self.pins)
            self.assertFalse(result['runtimeCommitVerifiedByThisCapture'])
            capture.assert_called_once_with(engine.SUCCESSOR_VERSION, '0.2')
            for refused in (path, engine.ROOT / 'capture.json'):
                with self.assertRaises(ValueError):
                    engine.capture_successor_for_review(refused)
            with self.assertRaises(ValueError):
                engine.documents(self.source, engine.SUCCESSOR_VERSION)
            self.assertEqual(capture.call_count, 1)

    def test_reviewed_upgrade_checks_pins_exact_projection_and_retained_observation(self):
        with patch.object(engine, 'SUCCESSOR_PINS', self.pins):
            self.assertEqual(engine.validate(self.source, engine.SUCCESSOR_VERSION), self.source)
            for field, value in [('tools', []), ('sourceEvidence', {'unreviewed': True})]:
                successor = {**self.source, field: value}
                with self.subTest(field=field), self.assertRaises(ValueError):
                    engine.documents(successor, engine.SUCCESSOR_VERSION)
            successor = deepcopy(self.source)
            successor['serverCard']['_meta'][engine.META]['keyless_actions'] = 160
            with self.assertRaisesRegex(ValueError, 'projection must agree'):
                engine.documents(successor, engine.SUCCESSOR_VERSION)

    def test_explicit_upgrade_writes_new_version_and_preserves_historical_files(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(engine, 'SUCCESSOR_PINS', self.pins):
            root = Path(directory)
            base = root / 'distribution'
            base.mkdir()
            historical = base / engine.SOURCE.name
            historical.write_bytes(engine.SOURCE.read_bytes())
            original = historical.read_bytes()
            version = engine.SUCCESSOR_VERSION
            selected_path = base / ('engine-mcp-observation-' + version + '.json')
            selected_path.write_bytes(engine.wire(self.source))
            older_inventory = root / engine.INVENTORY
            older_inventory.parent.mkdir()
            older_inventory.write_bytes((engine.ROOT / engine.INVENTORY).read_bytes())
            older = older_inventory.read_bytes()
            with patch.object(legacy, 'ROOT', root), patch.object(engine, 'ROOT', root), \
                    patch.object(engine, 'observe', return_value=self.source) as observe, \
                    patch('sys.argv', ['build_public_discovery.py', '--profile', version, '--refresh']), \
                    contextlib.redirect_stdout(StringIO()):
                legacy.main()
            observe.assert_called_once_with(version)
            self.assertEqual(historical.read_bytes(), original)
            self.assertEqual(older_inventory.read_bytes(), older)
            self.assertEqual(selected_path.read_bytes(), engine.wire(self.source))
            manifest = json.loads((base / 'public-discovery-deployment.json').read_bytes())
            name, = manifest['websiteOnlyDocuments']
            snapshot = (root / name).read_bytes()
            self.assertEqual(snapshot, (root / 'mcp/tool-inventory.json').read_bytes())
            self.assertEqual(json.loads(snapshot)['serverInfo']['version'], '0.2')
            self.assertEqual(manifest['sourceObservation'], str(selected_path.relative_to(root)))


class HiringEngineObservation(unittest.TestCase):
    def setUp(self):
        f6 = engine.reviewed_profile(engine.SUCCESSOR_VERSION)
        self.previous = json.loads(f6.observation.read_bytes())
        self.candidate = deepcopy(self.previous)
        self.candidate['format'] = 'aap-hosted-engine-observation/' + engine.HIRING_VERSION
        changed = self.candidate['engine']
        changed['account_tools'] += 6
        changed['catalogue']['mounted_descriptors_by_interface']['account'] += 6
        changed['catalogue']['browsable_names'] += 6
        self.candidate['serverCard']['_meta'][engine.META].update(deepcopy(changed))
        self.pins = {**engine.review_pins(self.candidate),
                     'observation': hashlib.sha256(engine.wire(self.candidate)).hexdigest()}

    def test_unpinned_hiring_profile_never_reads_network_for_publication(self):
        with patch.object(engine, 'HIRING_PINS', None), \
                patch.object(engine, 'build_opener', side_effect=AssertionError('network')), \
                patch('sys.argv', ['build_public_discovery.py', '--profile',
                                   engine.HIRING_VERSION, '--refresh']):
            with self.assertRaisesRegex(SystemExit, 'awaiting explicit review pins'):
                legacy.main()

    def test_capture_allowed_for_review_and_requires_exact_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'candidate.json'
            with patch.object(engine, '_capture', return_value=self.candidate) as capture:
                result = engine.capture_successor_for_review(path, engine.HIRING_VERSION)
            capture.assert_called_once_with(engine.HIRING_VERSION, '0.2')
            self.assertEqual(path.read_bytes(), engine.wire(self.candidate))
            self.assertEqual(result['candidatePins'], self.pins)
            self.assertFalse(result['runtimeCommitVerifiedByThisCapture'])
            for field, value in (('description', 'changed public copy'), ('version', '0.3')):
                other = deepcopy(self.candidate)
                other['serverCard'][field] = value
                refused = Path(folder) / (field + '.json')
                with patch.object(engine, '_capture', return_value=other), self.assertRaises(ValueError):
                    engine.capture_successor_for_review(refused, engine.HIRING_VERSION)
                self.assertTrue(refused.is_file())

    def test_candidate_requires_all_review_pins_and_preserves_f6_outputs(self):
        archived = engine.documents(self.previous, engine.SUCCESSOR_VERSION)
        with patch.object(engine, 'HIRING_PINS', self.pins):
            active = engine.documents(self.candidate, engine.HIRING_VERSION)
            manifest = engine.reviewed_profile(engine.HIRING_VERSION)
            retained = active[manifest.inventory][1]
            self.assertEqual(json.loads(retained)['engine']['account_tools'], 36)
            self.assertEqual(active['mcp/tool-inventory.json'][1], retained)
            self.assertEqual(archived['auth.md'], active['auth.md'])
            self.assertEqual(archived['.well-known/api-catalog'], active['.well-known/api-catalog'])
            self.assertEqual(archived, engine.documents(self.previous, engine.SUCCESSOR_VERSION))
            other = {**self.candidate, 'observedAt': '2099-01-01Z'}
            with self.assertRaisesRegex(ValueError, 'differs from the reviewed record'):
                engine.documents(other, engine.HIRING_VERSION)


if __name__ == '__main__':
    unittest.main()
