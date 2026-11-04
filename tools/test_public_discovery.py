"""Publication guards for the public tool snapshot; no network or core import."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import build_public_discovery as discovery


class CompletePublicSnapshot(unittest.TestCase):
    def setUp(self):
        self.source = json.loads(discovery.SOURCE.read_text())

    def test_retains_each_full_observed_schema_without_source_mutation(self):
        original = deepcopy(self.source)
        output = discovery.documents(self.source)
        inventory = json.loads(output['mcp/tool-inventory.json'][1])
        self.assertEqual(self.source, original)
        self.assertEqual({t['name']: t for t in inventory['tools']},
                         {t['name']: t for t in original['tools']})
        self.assertEqual(output['.well-known/ai-catalog.json'][0], 'application/ai-catalog+json')
        self.assertEqual(output['mcp/server-card'], output['.well-known/mcp/server-card.json'])
        catalog = json.loads(output['.well-known/api-catalog'][1])
        self.assertEqual(output['.well-known/api-catalog.json'], ('application/json', output['.well-known/api-catalog'][1]))
        described = catalog['linkset'][1]['describedby'][0]['href']
        self.assertEqual(described, discovery.WEBSITE + '/.well-known/mcp/server-card.json')
        self.assertNotIn(discovery.ORIGIN + '/mcp/server-card', output['.well-known/api-catalog'][1].decode())

    def test_missing_tool_duplicate_private_tool_or_write_hint_cannot_publish(self):
        cases = []
        missing = deepcopy(self.source); missing['tools'].pop(); cases.append(missing)
        duplicate = deepcopy(self.source); duplicate['tools'][0] = deepcopy(duplicate['tools'][1]); cases.append(duplicate)
        private = deepcopy(self.source); private['tools'][0]['name'] = 'account.payment.send'; cases.append(private)
        write = deepcopy(self.source); write['tools'][0]['annotations']['readOnlyHint'] = False; cases.append(write)
        for case in cases:
            with self.subTest(names=[t['name'] for t in case['tools']]):
                with self.assertRaises(ValueError):
                    discovery.documents(case)

    def test_incomplete_schema_and_description_cannot_publish(self):
        for field, value in [('inputSchema', None), ('inputSchema', {}),
                             ('inputSchema', {'type': 'string'}), ('description', '')]:
            case = deepcopy(self.source)
            if value is None:
                del case['tools'][0][field]
            else:
                case['tools'][0][field] = value
            with self.subTest(field=field, value=value):
                with self.assertRaises(ValueError):
                    discovery.documents(case)

    def test_another_endpoint_or_protocol_requires_review(self):
        for field, value in [('endpoint', 'https://example.invalid/mcp'),
                             ('protocolVersion', '2099-01-01')]:
            case = deepcopy(self.source); case[field] = value
            with self.assertRaises(ValueError):
                discovery.documents(case)

    def test_refresh_only_discovers_and_disables_redirect_following(self):
        calls = []
        original = self.source
        class Response:
            status = 200
            def __init__(self, payload): self.payload = payload
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def geturl(self): return discovery.ENDPOINT
            def read(self, _bound): return json.dumps(self.payload).encode()
        class Opener:
            def open(self, request, timeout):
                self_outer.assertEqual(request.full_url, discovery.ENDPOINT)
                packet = json.loads(request.data); calls.append(packet['method'])
                result = ({'protocolVersion': original['protocolVersion'], 'serverInfo': original['serverInfo']}
                          if packet['method'] == 'initialize' else {'tools': original['tools']})
                return Response({'jsonrpc': '2.0', 'id': packet['id'], 'result': result})
        self_outer = self
        def make_opener(handler):
            self.assertIsNone(handler.redirect_request(None, None, 302, '', {}, 'http://127.0.0.1/private'))
            return Opener()
        with patch.object(discovery, 'build_opener', side_effect=make_opener):
            result = discovery.observe()
        self.assertEqual(calls, ['initialize', 'tools/list'])
        self.assertEqual(result['tools'], self.source['tools'])


if __name__ == '__main__':
    unittest.main()
