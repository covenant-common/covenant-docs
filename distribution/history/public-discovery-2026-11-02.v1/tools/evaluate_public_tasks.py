#!/usr/bin/env python3
"""Replay frozen synthetic public-tool fixtures; --live explicitly tests the fixed public MCP.

This is a deterministic transport/result check, not an agent, model-selection,
directory-visibility or retention benchmark. No account or credential is used.
Only the standard library is required. Existing results are never overwritten.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
from pathlib import Path
import re
import time
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = 'https://jupie202020.pythonanywhere.com/mcp'
PROTOCOL = '2025-11-25'
SUITE_SHA256 = '5b7b00e8614d436e3d5c2c8d459c291710fe3a46cb18711900d1d9474d7cc3b5'
PROFILE_SHA256 = '6da02df79c079da0da502b591f6ac95446daf2a5752bf5020ce2d920af702271'
INVENTORY_SHA256 = 'bf8bf934d1136a24efec496fa8d6a2fe1034c7ffe0972229d7f589b7890600ad'
MAX_REQUEST_BYTES = 16384
MAX_RESPONSE_BYTES = 262144
REQUEST_TIMEOUT_SECONDS = 10
RUN_TIMEOUT_SECONDS = 180
NAMES = frozenset((
    'aap_public_listing_search', 'covenant_contract__draft',
    'covenant_contract__inspect', 'covenant_contract__compare',
    'covenant_contract__render', 'covenant_marketplace__quick_trade',
    'covenant_review__review', 'covenant_review__authority',
    'covenant_review__evidence'))


class EvaluationError(ValueError):
    """A bounded input, protocol or result check failed."""


def canonical(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True,
                      separators=(',', ':'), allow_nan=False).encode('ascii')


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def strict_json(raw):
    def pairs(rows):
        value = {}
        for key, item in rows:
            if key in value:
                raise EvaluationError('Duplicate JSON property')
            value[key] = item
        return value
    def constant(_):
        raise EvaluationError('Non-finite JSON number')
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise EvaluationError('Malformed or ambiguous JSON') from exc


def load_inputs():
    suite = strict_json((ROOT / 'distribution/ato-prompt-set.json').read_bytes())
    profile = strict_json((ROOT / 'distribution/ato-execution-profile.json').read_bytes())
    inventory_bytes = (ROOT / 'mcp/tool-inventory.json').read_bytes()
    inventory = strict_json(inventory_bytes)
    frozen = {key: suite[key] for key in ('suite_version', 'fixtures', 'prompts')}
    if digest(frozen) != SUITE_SHA256 or suite['suite_sha256'] != SUITE_SHA256:
        raise EvaluationError('Frozen prompt/fixture suite changed; version and review it explicitly')
    body = {key: value for key, value in profile.items() if key != 'profile_sha256'}
    if digest(body) != PROFILE_SHA256 or profile['profile_sha256'] != PROFILE_SHA256:
        raise EvaluationError('Frozen execution profile changed; do not adapt a baseline to results')
    if hashlib.sha256(inventory_bytes).hexdigest() != INVENTORY_SHA256:
        raise EvaluationError('Retained inventory changed; review a new execution profile')
    if (profile['suite_sha256'] != SUITE_SHA256 or profile['endpoint'] != ENDPOINT or
            profile['protocol_version'] != PROTOCOL or profile['inventory_sha256'] != INVENTORY_SHA256):
        raise EvaluationError('Execution profile source/protocol mismatch')
    if suite['fixture_sha256'] != {key: digest(value) for key, value in suite['fixtures'].items()}:
        raise EvaluationError('Fixture hash mismatch')
    expected_ids = [f'ATO-{number:02d}' for number in range(1, 21)]
    if ([row['id'] for row in suite['prompts']] != expected_ids or
            [row['prompt_id'] for row in profile['cases']] != expected_ids):
        raise EvaluationError('All twenty immutable prompt IDs must be retained in order')
    schemas = {row['name']: row['inputSchema'] for row in inventory['tools']}
    if set(schemas) != NAMES or len(inventory['tools']) != 9:
        raise EvaluationError('Complete nine-tool inventory required')
    for prompt, case in zip(suite['prompts'], profile['cases']):
        if case['tool'] is None:
            if (prompt['class'] != 'negative' or case['arguments'] is not None or
                    case['assertions'] or case['synthetic_fixture_payload'] is not None):
                raise EvaluationError('Negative controls must have no dispatch or substitute tool')
        else:
            if case['tool'] not in prompt['expected_first_tool_any_of']:
                raise EvaluationError('Execution case does not match its frozen task oracle')
            validate_schema(case['arguments'], schemas[case['tool']])
            if len(canonical({'name': case['tool'], 'arguments': case['arguments']})) > MAX_REQUEST_BYTES - 512:
                raise EvaluationError('Frozen request is too large')
    return suite, profile, inventory


def validate_schema(value, schema, path='$', depth=0):
    """Validate every constraint used by this pinned input-schema snapshot.

    This is deliberately a bounded subset, not a general JSON Schema validator.
    Unknown validation vocabulary refuses; the full inventory hash is pinned too.
    """
    supported = {'type', 'properties', 'required', 'additionalProperties', 'items',
                 'maxProperties', 'minItems', 'maxItems', 'minLength', 'maxLength',
                 'pattern', 'minimum', 'maximum', 'description', 'title', 'default'}
    if depth > 32 or set(schema) - supported:
        raise EvaluationError('Unsupported or overly deep pinned input schema')
    types = schema.get('type', [])
    if isinstance(types, str):
        types = [types]
    matches = {'object': type(value) is dict, 'array': type(value) is list,
               'string': type(value) is str, 'integer': type(value) is int,
               'number': type(value) in (int, float), 'boolean': type(value) is bool,
               'null': value is None}
    if types and not any(matches.get(kind, False) for kind in types):
        raise EvaluationError('Input type mismatch at ' + path)
    if type(value) is dict:
        if not set(schema.get('required', [])).issubset(value):
            raise EvaluationError('Required input missing at ' + path)
        properties = schema.get('properties', {})
        if schema.get('additionalProperties') is False and set(value) - set(properties):
            raise EvaluationError('Unexpected input at ' + path)
        if len(value) > schema.get('maxProperties', len(value)):
            raise EvaluationError('Too many input properties at ' + path)
        for key in value.keys() & properties.keys():
            validate_schema(value[key], properties[key], path + '.' + key, depth + 1)
    if type(value) is list:
        if not schema.get('minItems', 0) <= len(value) <= schema.get('maxItems', len(value)):
            raise EvaluationError('Input array bound at ' + path)
        if 'items' in schema:
            for item in value:
                validate_schema(item, schema['items'], path + '[]', depth + 1)
    if type(value) is str:
        if not schema.get('minLength', 0) <= len(value) <= schema.get('maxLength', len(value)):
            raise EvaluationError('Input string bound at ' + path)
        if 'pattern' in schema and re.search(schema['pattern'], value) is None:
            raise EvaluationError('Input pattern mismatch at ' + path)
    if type(value) in (int, float):
        if not schema.get('minimum', value) <= value <= schema.get('maximum', value):
            raise EvaluationError('Input numeric bound at ' + path)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def bounded_read(response, clock, deadline):
    """Read bounded chunks and recheck the wall deadline between socket reads.

    HTTPResponse.read1 performs one buffered/raw read; a peer cannot keep an
    unbounded read(n) alive indefinitely by trickling a large response body.
    The connection's idle timeout remains active during each individual read.
    """
    reader = getattr(response, 'read1', None)
    if not callable(reader):
        raise EvaluationError('Bounded single-read transport is required')
    chunks, size = [], 0
    while True:
        if clock() >= deadline:
            raise EvaluationError('Response wall deadline exhausted')
        chunk = reader(min(16384, MAX_RESPONSE_BYTES + 1 - size))
        if type(chunk) is not bytes:
            raise EvaluationError('Expected binary HTTP response')
        size += len(chunk)
        if size > MAX_RESPONSE_BYTES:
            raise EvaluationError('Response exceeds bounded public result size')
        if clock() >= deadline:
            raise EvaluationError('Response wall deadline exhausted')
        if not chunk:
            return b''.join(chunks)
        chunks.append(chunk)


class LiveTransport:
    live = True

    def __init__(self, opener=None, clock=time.monotonic):
        # No environment proxy credentials, cookies, Authorization header, URL option or retry path.
        self.opener = opener or build_opener(ProxyHandler({}), NoRedirect())
        self.clock = clock
        self.deadline = clock() + RUN_TIMEOUT_SECONDS
        self.records = []

    def rpc(self, ident, method, params=None):
        if method not in ('initialize', 'tools/list', 'tools/call'):
            raise EvaluationError('RPC method is outside the fixed read-only profile')
        if method == 'tools/call' and (type(params) is not dict or
                set(params) != {'name', 'arguments'} or params['name'] not in NAMES):
            raise EvaluationError('Tool is outside the fixed nine-tool read-only allowlist')
        packet = {'jsonrpc': '2.0', 'id': ident, 'method': method}
        if params is not None:
            packet['params'] = params
        body = canonical(packet)
        if len(body) > MAX_REQUEST_BYTES:
            raise EvaluationError('Request exceeds bounded public fixture size')
        remaining = self.deadline - self.clock()
        if remaining <= 0:
            raise EvaluationError('Run deadline exhausted; no request sent')
        request = Request(ENDPOINT, data=body, method='POST', headers={
            'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
            'Accept-Encoding': 'identity', 'MCP-Protocol-Version': PROTOCOL,
            'User-Agent': 'covenant-public-task-evaluation/0.1'})
        record = {'request': packet, 'response': None, 'elapsed_seconds': None,
                  'response_bytes': None, 'error': None}
        self.records.append(record)
        started = self.clock()
        try:
            with self.opener.open(request, timeout=min(REQUEST_TIMEOUT_SECONDS, remaining)) as response:
                if response.status != 200 or response.geturl() != ENDPOINT:
                    raise EvaluationError('Unexpected status or endpoint; redirects are refused')
                media = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
                if media != 'application/json' or response.headers.get('Content-Encoding', 'identity') != 'identity':
                    raise EvaluationError('Expected uncompressed bounded JSON response')
                raw = bounded_read(response, self.clock,
                                   min(self.deadline, started + REQUEST_TIMEOUT_SECONDS))
            record['response_bytes'] = len(raw)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise EvaluationError('Response exceeds bounded public result size')
            reply = strict_json(raw)
            record['response'] = reply
            if (type(reply) is not dict or reply.get('jsonrpc') != '2.0' or
                    type(reply.get('id')) is not int or reply['id'] != ident or
                    'error' in reply or 'result' not in reply):
                raise EvaluationError('JSON-RPC reply failed identity/result checks')
            return reply['result']
        except Exception as exc:
            record['error'] = type(exc).__name__ + ': ' + str(exc)[:300]
            raise EvaluationError(record['error']) from exc
        finally:
            record['elapsed_seconds'] = round(self.clock() - started, 6)


class FixtureTransport:
    live = False

    def __init__(self, profile, inventory):
        self.profile, self.inventory = profile, inventory
        self.pending = iter(row for row in profile['cases'] if row['tool'] is not None)
        self.records = []

    def rpc(self, ident, method, params=None):
        if method == 'initialize':
            result = {'protocolVersion': PROTOCOL, 'serverInfo': self.inventory['serverInfo']}
        elif method == 'tools/list':
            result = {'tools': self.inventory['tools']}
        elif method == 'tools/call':
            case = next(self.pending)
            if params != {'name': case['tool'], 'arguments': case['arguments']}:
                raise EvaluationError('Replay request differs from frozen execution fixture')
            result = {'content': [{'type': 'text', 'text': canonical(case['synthetic_fixture_payload']).decode()}]}
        else:
            raise EvaluationError('Unknown fixture method')
        self.records.append({'request': {'jsonrpc': '2.0', 'id': ident, 'method': method,
                                         'params': params},
                             'response': {'jsonrpc': '2.0', 'id': ident, 'result': result},
                             'elapsed_seconds': None, 'response_bytes': None, 'error': None})
        return result


def check_discovery(initial, listing, inventory):
    if (type(initial) is not dict or initial.get('protocolVersion') != PROTOCOL or
            initial.get('serverInfo') != inventory['serverInfo']):
        raise EvaluationError('Protocol/server identity drift; retain the legacy runtime identity')
    if type(listing) is not dict or listing.get('nextCursor'):
        raise EvaluationError('Incomplete or paginated inventory requires review')
    tools = listing.get('tools')
    if (type(tools) is not list or len(tools) != 9 or
            any(type(row) is not dict for row in tools) or
            {row.get('name') for row in tools} != NAMES):
        raise EvaluationError('Public tool set drift; do not omit, add or dispatch unknown tools')
    if any(row.get('annotations', {}).get('readOnlyHint') is not True for row in tools):
        raise EvaluationError('Every public tool must retain its read-only annotation')
    if canonical(sorted(tools, key=lambda row: row['name'])) != canonical(inventory['tools']):
        raise EvaluationError('Public tool metadata/schema/annotation drift; review before dispatch')


def decode_tool_result(result):
    if type(result) is not dict or result.get('isError', False) is not False:
        raise EvaluationError('Tool returned an error or malformed result')
    content = result.get('content')
    if (type(content) is not list or not 1 <= len(content) <= 8 or
            any(type(row) is not dict or row.get('type') != 'text' or
                type(row.get('text')) is not str for row in content)):
        raise EvaluationError('Expected bounded text-only public result')
    # The original exact JSON is first; optional plain-English companions are retained, not substituted.
    payload = strict_json(content[0]['text'])
    if type(payload) is not dict:
        raise EvaluationError('Expected an object public payload')
    return payload, sum(len(row['text']) for row in content)


def pointer(value, path):
    try:
        for token in path.split('/')[1:]:
            token = token.replace('~1', '/').replace('~0', '~')
            value = value[int(token)] if type(value) is list else value[token]
        return value
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise EvaluationError('Missing expected result field ' + path) from exc


def assertions_for(payload, case):
    findings = []
    for assertion in case['assertions']:
        actual = pointer(payload, assertion['path'])
        expected, operator = assertion['value'], assertion['operator']
        if operator == 'equals':
            passed = type(actual) is type(expected) and actual == expected
        elif operator == 'contains':
            passed = type(actual) is str and expected in actual
        elif operator == 'pattern':
            passed = type(actual) is str and re.fullmatch(expected, actual) is not None
        elif operator == 'at_most':
            passed = type(actual) is int and 0 <= actual <= expected
        else:
            raise EvaluationError('Unsupported assertion operator')
        findings.append({**assertion, 'passed': passed})
    if case['tool'] == 'aap_public_listing_search':
        result = payload.get('result', {})
        passed = (type(result.get('items')) is list and type(result.get('returned')) is int and
                  result['returned'] == len(result['items']) and
                  type(result.get('total')) is int and result['total'] >= result['returned'])
        findings.append({'path': '/result', 'operator': 'consistent_public_page', 'passed': passed})
    return findings


def evaluate(transport, suite, profile, inventory):
    started = datetime.now(timezone.utc).isoformat()
    results, blocked = [], None
    try:
        initial = transport.rpc(1, 'initialize', {'protocolVersion': PROTOCOL, 'capabilities': {},
            'clientInfo': {'name': 'covenant-public-task-evaluation', 'version': '0.1'}})
        listing = transport.rpc(2, 'tools/list', {})
        check_discovery(initial, listing, inventory)
    except Exception as exc:
        blocked = type(exc).__name__ + ': ' + str(exc)[:400]
    for number, case in enumerate(profile['cases'], 3):
        row = {'prompt_id': case['prompt_id'], 'tool': case['tool'], 'status': None,
               'actual_tool_call_count': 0, 'fixture_tool_call_count': 0,
               'elapsed_seconds': None, 'visible_response_characters': None,
               'assertions': [], 'error': None}
        if case['tool'] is None:
            row['status'] = 'HARNESS_ABSTENTION_ZERO_DISPATCH'
        elif blocked:
            row.update(status='BLOCKED_NOT_RUN', error=blocked)
        else:
            before = len(transport.records)
            try:
                result = transport.rpc(number, 'tools/call',
                                       {'name': case['tool'], 'arguments': case['arguments']})
                payload, chars = decode_tool_result(result)
                row['visible_response_characters'] = chars if transport.live else None
                row['assertions'] = assertions_for(payload, case)
                row['status'] = 'PASS' if all(item['passed'] for item in row['assertions']) else 'FAIL'
                if row['status'] == 'FAIL':
                    blocked = 'Expected result assertion failed for ' + case['prompt_id'] + '; remaining calls not run'
                    row['error'] = blocked
            except Exception as exc:
                blocked = type(exc).__name__ + ': ' + str(exc)[:400]
                row.update(status='ERROR_STOPPED_WITHOUT_RETRY', error=blocked)
            records = transport.records[before:]
            row['actual_tool_call_count' if transport.live else 'fixture_tool_call_count'] = len(records)
            if transport.live and records:
                row['elapsed_seconds'] = records[-1]['elapsed_seconds']
        results.append(row)
    passed = sum(row['status'] == 'PASS' for row in results)
    complete = passed == 14 and all(row['actual_tool_call_count'] == 0 for row in results[-6:])
    actual_calls = sum(row['actual_tool_call_count'] for row in results)
    return {'format': 'aap-ato-execution-result/0.1',
            'status': ('PASS' if transport.live else 'PASS_FIXTURE_REPLAY') if complete else 'FAIL',
            'mode': 'LIVE_PUBLIC_DETERMINISTIC_EXECUTION' if transport.live else 'OFFLINE_SYNTHETIC_FIXTURE_REPLAY',
            'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
            'suite_version': suite['suite_version'], 'suite_sha256': SUITE_SHA256,
            'execution_profile_sha256': PROFILE_SHA256, 'inventory_sha256': INVENTORY_SHA256,
            'protocol_version': PROTOCOL, 'endpoint': ENDPOINT if transport.live else None,
            'runtime_server_info_expected': inventory['serverInfo'],
            'measurement_boundaries': {'organic_store_visibility': 'NOT_MEASURED',
                'model_tool_selection': 'NOT_MEASURED', 'cross_model_rankings': 'NOT_MEASURED',
                'human_usability': 'NOT_MEASURED', 'retention': 'NOT_MEASURED',
                'outside_world_performance_or_payment': 'NOT_MEASURED',
                'live_deterministic_execution': 'MEASURED' if transport.live else 'NOT_MEASURED'},
            'counts': {'prompts': 20, 'predetermined_positive_checks_passed': passed,
                'negative_harness_controls_zero_dispatch': 6, 'actual_tool_calls': actual_calls,
                'actual_rpc_requests_attempted': len(transport.records) if transport.live else 0,
                'fixture_tool_calls': sum(row['fixture_tool_call_count'] for row in results),
                'fixture_rpc_replays': len(transport.records) if not transport.live else 0,
                'errors': sum(row['status'] in ('FAIL', 'ERROR_STOPPED_WITHOUT_RETRY', 'BLOCKED_NOT_RUN') for row in results)},
            'negative_control_boundary': 'Predetermined harness dispatch guards only; no agent abstention rate is measured.',
            'case_results': results, 'rpc_records': transport.records, 'blocking_condition': blocked}


def report_html(result):
    esc = lambda value: html.escape(str(value))
    rows = ''.join('<tr><td>' + esc(row['prompt_id']) + '</td><td>' + esc(row['tool'] or 'No dispatch') +
                   '</td><td>' + esc(row['status']) + '</td><td>' + esc(row['elapsed_seconds']) + '</td></tr>'
                   for row in result['case_results'])
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Public task execution check</title><style>'
            'html{font-family:"Times New Roman",Times,serif;font-size:16px;color:#000;background:#fff}'
            'body{margin:1rem;line-height:1.16}main{max-width:68rem;margin:auto;border:1px solid #000;padding:1rem}'
            'h1,h2,p,td,th,code,a{font-family:inherit;font-size:1rem}h1,h2{margin:1rem 0 .382rem}'
            'h1{margin-top:0}p{margin:.382rem 0 .618rem}a{color:#000}'
            'table{width:100%;border-collapse:collapse;margin:.618rem 0}td,th{border:1px solid #000;'
            'padding:.382rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}'
            'code{overflow-wrap:anywhere}</style></head><body><main><h1>Public task execution check</h1>'
            '<p><strong>' + esc(result['status']) + '</strong> · ' + esc(result['mode']) + '</p>'
            '<p>' + esc(result['started_at_utc']) + ' · <a href="results.json">Exact results and transport records</a></p>'
            '<p>The harness uses predetermined calls. Offline replay uses explicitly synthetic transport fixtures; '
            'it does not connect to the service. Six negative controls dispatch nothing by construction. '
            'Organic visibility, agent tool choice, human usability, model rankings and retention are not measured.</p>'
            '<p>Actual public tool calls: ' + esc(result['counts']['actual_tool_calls']) +
            '. Positive checks passed: ' + esc(result['counts']['predetermined_positive_checks_passed']) + '/14.</p>'
            '<table><thead><tr><th>Prompt</th><th>Tool</th><th>Result</th><th>Live seconds</th></tr></thead><tbody>' +
            rows + '</tbody></table><p>Suite SHA-256: <code>' + esc(result['suite_sha256']) +
            '</code></p><p>Any unsupported or unavailable result remains unknown; no signing, publication, '
            'account creation, private access, provider operation or money movement is tested.</p></main></body></html>')


def check_output_directory(directory):
    directory = Path(directory)
    if directory.is_symlink() or directory.exists() and not directory.is_dir():
        raise EvaluationError('Result path must be a regular directory, not a file or symlink')
    if any((directory / name).exists() or (directory / name).is_symlink()
           for name in ('results.json', 'index.html')):
        raise EvaluationError('Existing results are immutable; choose a new output directory')


def write_results(directory, result):
    directory = Path(directory)
    check_output_directory(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'results.json').open('x') as handle:
        handle.write(json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False) + '\n')
    with (directory / 'index.html').open('x') as handle:
        handle.write(report_html(result))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true', help='Explicitly call only the fixed anonymous public MCP')
    parser.add_argument('--out', type=Path, help='Write a new results.json and viewable index.html; refuse overwrite')
    args = parser.parse_args(argv)
    try:
        if args.out:
            check_output_directory(args.out)  # Refuse an old result before any live request.
        suite, profile, inventory = load_inputs()
        transport = LiveTransport() if args.live else FixtureTransport(profile, inventory)
        result = evaluate(transport, suite, profile, inventory)
        if args.out:
            write_results(args.out, result)
        print(json.dumps({key: value for key, value in result.items() if key not in ('case_results', 'rpc_records')}, indent=2))
        return 0 if result['status'].startswith('PASS') else 1
    except (EvaluationError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({'status': 'FAIL_BEFORE_RUN', 'error': str(exc)[:400],
                          'live_execution_claimed': False}, indent=2))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
