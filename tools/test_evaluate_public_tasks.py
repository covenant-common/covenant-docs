"""Independent failure/authority controls for the public-task evaluator; no network."""
import contextlib
import copy
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

import evaluate_public_tasks as E


class Response:
    status = 200
    headers = {'Content-Type': 'application/json'}

    def __init__(self, body, url=E.ENDPOINT, headers=None):
        self.body, self.url = body, url
        self.offset = 0
        if headers is not None:
            self.headers = headers

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def geturl(self):
        return self.url

    def read1(self, maximum):
        chunk = self.body[self.offset:self.offset + maximum]
        self.offset += len(chunk)
        return chunk


class Opener:
    def __init__(self, response):
        self.response, self.calls = response, []

    def open(self, request, timeout):
        self.calls.append((request, timeout))
        return self.response


def reply(result=None, ident=1):
    return E.canonical({'jsonrpc': '2.0', 'id': ident, 'result': result or {}})


class FrozenInputs(unittest.TestCase):
    def setUp(self):
        self.suite, self.profile, self.inventory = E.load_inputs()

    def test_twenty_frozen_ids_cover_all_nine_original_tools_and_six_abstentions(self):
        self.assertEqual([row['id'] for row in self.suite['prompts']],
                         [f'ATO-{i:02d}' for i in range(1, 21)])
        self.assertEqual({row['tool'] for row in self.profile['cases'] if row['tool']}, E.NAMES)
        self.assertEqual(sum(row['tool'] is None for row in self.profile['cases']), 6)
        self.assertEqual(self.inventory['serverInfo'], {'name': 'aap-public-directory', 'version': '0.1'})

    def test_default_is_explicitly_synthetic_and_does_not_construct_live_transport(self):
        with patch.object(E, 'LiveTransport', side_effect=AssertionError('network path')), \
                contextlib.redirect_stdout(io.StringIO()) as stdout:
            self.assertEqual(E.main([]), 0)
        result = json.loads(stdout.getvalue())
        self.assertEqual(result['mode'], 'OFFLINE_SYNTHETIC_FIXTURE_REPLAY')
        self.assertEqual(result['counts']['actual_rpc_requests_attempted'], 0)
        self.assertEqual(result['measurement_boundaries']['live_deterministic_execution'], 'NOT_MEASURED')
        self.assertEqual(result['measurement_boundaries']['model_tool_selection'], 'NOT_MEASURED')

    def test_replay_validates_fourteen_responses_but_never_claims_calls_or_latency(self):
        result = E.evaluate(E.FixtureTransport(self.profile, self.inventory),
                            self.suite, self.profile, self.inventory)
        self.assertEqual(result['status'], 'PASS_FIXTURE_REPLAY')
        self.assertEqual(result['counts']['fixture_tool_calls'], 14)
        self.assertEqual(result['counts']['actual_tool_calls'], 0)
        self.assertTrue(all(row['elapsed_seconds'] is None for row in result['case_results']))
        self.assertTrue(all(row['status'] == 'HARNESS_ABSTENTION_ZERO_DISPATCH'
                            for row in result['case_results'][-6:]))

    def test_suite_profile_and_fixture_tampering_refuse_before_execution(self):
        for filename, mutate in [
            ('ato-prompt-set.json', lambda x: x['prompts'][0].update(prompt='changed')),
            ('ato-prompt-set.json', lambda x: x['fixture_sha256'].update({'brief-before.json': '0' * 64})),
            ('ato-execution-profile.json', lambda x: x['cases'][0].update(tool='aap_payment_send')),
        ]:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as td:
                root = Path(td)
                (root / 'distribution').mkdir()
                (root / 'mcp').mkdir()
                for name in ['distribution/ato-prompt-set.json', 'distribution/ato-execution-profile.json',
                             'mcp/tool-inventory.json']:
                    shutil.copyfile(E.ROOT / name, root / name)
                path = root / 'distribution' / filename
                value = json.loads(path.read_text())
                mutate(value)
                path.write_text(json.dumps(value))
                with patch.object(E, 'ROOT', root), self.assertRaises(E.EvaluationError):
                    E.load_inputs()

    def test_input_schema_enforces_required_nested_bounds_pattern_and_integer_type(self):
        schemas = {row['name']: row['inputSchema'] for row in self.inventory['tools']}
        cases = [
            ('aap_public_listing_search', {'limit': True}),
            ('aap_public_listing_search', {'limit': 51}),
            ('aap_public_listing_search', {'query': 'x' * 121}),
            ('aap_public_listing_search', {'Authorization': 'forbidden'}),
            ('covenant_contract__draft', {'title': 'x', 'parties': [], 'clauses': [{'id': 'x'}]}),
            ('covenant_marketplace__quick_trade', {**self.suite['fixtures']['simple-offer-input.json'], 'seller': 'bad'}),
        ]
        for name, arguments in cases:
            with self.subTest(name=name, arguments=arguments), self.assertRaises(E.EvaluationError):
                E.validate_schema(arguments, schemas[name])
        with self.assertRaises(E.EvaluationError):
            E.validate_schema({}, {'type': 'object', 'oneOf': []})


class ResultAndDiscoveryControls(unittest.TestCase):
    def setUp(self):
        self.suite, self.profile, self.inventory = E.load_inputs()

    def run_modified(self, modify):
        class Modified(E.FixtureTransport):
            def rpc(self, ident, method, params=None):
                result = copy.deepcopy(super().rpc(ident, method, params))
                return modify(method, result)
        transport = Modified(self.profile, self.inventory)
        result = E.evaluate(transport, self.suite, self.profile, self.inventory)
        return result, transport

    def test_missing_duplicate_private_schema_and_write_hint_drift_stop_before_tool_calls(self):
        mutations = [lambda tools: tools.pop(),
                     lambda tools: tools.__setitem__(0, tools[1]),
                     lambda tools: tools[0].update(name='aap_private_account_write'),
                     lambda tools: tools[0]['inputSchema'].update(additionalProperties=True),
                     lambda tools: tools[0]['annotations'].update(readOnlyHint=False)]
        for mutate in mutations:
            def change(method, result):
                if method == 'tools/list':
                    mutate(result['tools'])
                return result
            with self.subTest(mutation=mutate):
                result, transport = self.run_modified(change)
                self.assertEqual(result['status'], 'FAIL')
                self.assertEqual(len(transport.records), 2)
                self.assertEqual(result['counts']['fixture_tool_calls'], 0)
                self.assertEqual(result['counts']['negative_harness_controls_zero_dispatch'], 6)

    def test_pagination_and_silent_server_rename_are_not_accepted(self):
        for target in ['pagination', 'identity']:
            def change(method, result):
                if method == 'tools/list' and target == 'pagination':
                    result['nextCursor'] = 'more'
                if method == 'initialize' and target == 'identity':
                    result['serverInfo']['name'] = 'new-marketing-name'
                return result
            result, transport = self.run_modified(change)
            self.assertEqual(result['status'], 'FAIL')
            self.assertEqual(len(transport.records), 2)

    def test_unsigned_or_no_payment_boundary_cannot_turn_true_and_pass(self):
        def change(method, result):
            if method == 'tools/call':
                payload = json.loads(result['content'][0]['text'])
                if 'external_execution' in payload:
                    payload['external_execution'] = True
                    result['content'][0]['text'] = json.dumps(payload)
            return result
        result, transport = self.run_modified(change)
        self.assertEqual(result['status'], 'FAIL')
        self.assertEqual(result['case_results'][0]['status'], 'FAIL')
        self.assertEqual(result['case_results'][1]['status'], 'BLOCKED_NOT_RUN')
        self.assertEqual(len(transport.records), 3)

    def test_missing_result_field_stops_without_retry_or_fallback_to_fixture(self):
        def change(method, result):
            if method == 'tools/call':
                result['content'][0]['text'] = '{}'
            return result
        result, transport = self.run_modified(change)
        self.assertEqual(result['case_results'][0]['status'], 'ERROR_STOPPED_WITHOUT_RETRY')
        self.assertEqual(result['case_results'][1]['status'], 'BLOCKED_NOT_RUN')
        self.assertEqual(len(transport.records), 3)

    def test_tool_errors_refuse_and_original_json_precedes_optional_companion(self):
        with self.assertRaises(E.EvaluationError):
            E.decode_tool_result({'isError': True, 'content': []})
        payload, chars = E.decode_tool_result({'content': [
            {'type': 'text', 'text': '{"verification_status":"NO_PROOFS_PROVIDED"}'},
            {'type': 'text', 'text': 'No proof supplied.'}]})
        self.assertEqual(payload['verification_status'], 'NO_PROOFS_PROVIDED')
        self.assertGreater(chars, len('No proof supplied.'))
        with self.assertRaises(E.EvaluationError):
            E.decode_tool_result({'content': [{'type': 'image', 'data': 'untrusted'}]})


class TransportControls(unittest.TestCase):
    def test_mocked_live_flow_records_actual_attempts_separately_from_replays(self):
        suite, profile, inventory = E.load_inputs()
        fixtures = E.FixtureTransport(profile, inventory)
        class ProtocolOpener:
            def open(self, request, timeout):
                packet = json.loads(request.data)
                result = fixtures.rpc(packet['id'], packet['method'], packet.get('params'))
                return Response(reply(result, packet['id']))
        result = E.evaluate(E.LiveTransport(opener=ProtocolOpener()), suite, profile, inventory)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['counts']['actual_tool_calls'], 14)
        self.assertEqual(result['counts']['actual_rpc_requests_attempted'], 16)
        self.assertEqual(result['counts']['fixture_tool_calls'], 0)
        self.assertTrue(all(row['elapsed_seconds'] is not None for row in result['case_results'][:14]))
        self.assertEqual(result['measurement_boundaries']['model_tool_selection'], 'NOT_MEASURED')

    def test_fixed_endpoint_no_credentials_and_bounded_timeout(self):
        opener = Opener(Response(reply()))
        live = E.LiveTransport(opener=opener)
        self.assertEqual(live.rpc(1, 'tools/list', {}), {})
        request, timeout = opener.calls[0]
        self.assertEqual(request.full_url, E.ENDPOINT)
        self.assertEqual(request.get_method(), 'POST')
        self.assertLessEqual(timeout, E.REQUEST_TIMEOUT_SECONDS)
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertNotIn('authorization', headers)
        self.assertNotIn('cookie', headers)
        self.assertNotIn('proxy-authorization', headers)
        self.assertEqual(headers['mcp-protocol-version'], E.PROTOCOL)

    def test_unknown_method_private_tool_and_large_request_never_open_network(self):
        opener = Opener(Response(reply()))
        live = E.LiveTransport(opener=opener)
        for method, params in [('payments/send', {}),
                               ('tools/call', {'name': 'aap_payment_send', 'arguments': {}}),
                               ('tools/call', {'name': 'covenant_contract__draft', 'arguments': {'text': 'x' * E.MAX_REQUEST_BYTES}})]:
            with self.subTest(method=method), self.assertRaises(E.EvaluationError):
                live.rpc(1, method, params)
        self.assertFalse(opener.calls)
        self.assertFalse(live.records)

    def test_no_redirect_following_or_env_proxy_handler(self):
        self.assertIsNone(E.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://evil.example'))
        with patch.object(E, 'build_opener', return_value=object()) as build:
            E.LiveTransport()
        handlers = build.call_args.args
        self.assertEqual(handlers[0].proxies, {})
        self.assertIsInstance(handlers[1], E.NoRedirect)

    def test_bad_origin_media_compression_rpc_id_json_and_oversized_response_refuse(self):
        responses = [
            Response(reply(), url='https://other.example/mcp'),
            Response(reply(), headers={'Content-Type': 'text/event-stream'}),
            Response(reply(), headers={'Content-Type': 'application/json', 'Content-Encoding': 'gzip'}),
            Response(reply(ident=2)),
            Response(b'{"jsonrpc":"2.0","id":true,"result":{}}'),
            Response(b'{"jsonrpc":"2.0","id":1,"error":{"code":-1}}'),
            Response(b'{"id":1,"id":1}'),
            Response(b'{"value":NaN}'),
            Response(b'x' * (E.MAX_RESPONSE_BYTES + 1)),
        ]
        for response in responses:
            opener = Opener(response)
            live = E.LiveTransport(opener=opener)
            with self.subTest(response=response), self.assertRaises(E.EvaluationError):
                live.rpc(1, 'tools/list', {})
            self.assertEqual(len(opener.calls), 1)
            self.assertIsNotNone(live.records[0]['error'])

    def test_deadline_stops_without_dispatch(self):
        now = [0]
        opener = Opener(Response(reply()))
        live = E.LiveTransport(opener=opener, clock=lambda: now[0])
        now[0] = E.RUN_TIMEOUT_SECONDS + 1
        with self.assertRaises(E.EvaluationError):
            live.rpc(1, 'tools/list', {})
        self.assertFalse(opener.calls)

    def test_slow_trickle_cannot_avoid_response_wall_deadline(self):
        now = [0]
        class Trickle(Response):
            def read1(self, maximum):
                now[0] += 6
                return b' '
        with self.assertRaisesRegex(E.EvaluationError, 'wall deadline'):
            E.bounded_read(Trickle(b''), lambda: now[0], 10)
        self.assertEqual(now[0], 12)


class SavedArtifacts(unittest.TestCase):
    def test_existing_result_refuses_before_live_transport_is_constructed(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / 'results.json').write_text('preserved')
            with patch.object(E, 'LiveTransport', side_effect=AssertionError('network path')), \
                    contextlib.redirect_stdout(io.StringIO()) as stdout:
                self.assertEqual(E.main(['--live', '--out', td]), 1)
            self.assertEqual(json.loads(stdout.getvalue())['status'], 'FAIL_BEFORE_RUN')
            self.assertEqual((Path(td) / 'results.json').read_text(), 'preserved')

    def test_saved_result_has_html_companion_escapes_remote_text_and_never_overwrites(self):
        suite, profile, inventory = E.load_inputs()
        result = E.evaluate(E.FixtureTransport(profile, inventory), suite, profile, inventory)
        result['case_results'][0]['tool'] = '<script>untrusted()</script>'
        with tempfile.TemporaryDirectory() as td:
            E.write_results(td, result)
            path = Path(td)
            original = (path / 'results.json').read_bytes()
            page = (path / 'index.html').read_text()
            self.assertIn('&lt;script&gt;', page)
            self.assertNotIn('<script>', page)
            self.assertIn('Times New Roman', page)
            self.assertIn('OFFLINE_SYNTHETIC_FIXTURE_REPLAY', page)
            with self.assertRaises(E.EvaluationError):
                E.write_results(td, result)
            self.assertEqual((path / 'results.json').read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
