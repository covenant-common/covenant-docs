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
        manifest = json.loads((engine.ROOT / 'distribution/public-discovery-deployment.json').read_text())
        self.assertEqual(len(manifest['documents']), 6)
        self.assertEqual(manifest['websiteOnlyDocuments'], [engine.INVENTORY])
        self.assertEqual(manifest['hostedEngineStatus'], 'OBSERVED_LIVE')
        self.assertEqual(manifest['staticWebsiteStatus'], 'PREPARED_FOR_PUBLICATION')
        output = engine.documents(self.source)
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
                    patch('sys.argv', ['build_public_discovery.py', '--refresh']), \
                    contextlib.redirect_stdout(StringIO()):
                legacy.main()
            self.assertEqual(retained.read_bytes(), original)
            published = json.loads((root / 'mcp/tool-inventory.json').read_text())
            self.assertEqual(published['observedAt'], self.source['observedAt'])


if __name__ == '__main__':
    unittest.main()
