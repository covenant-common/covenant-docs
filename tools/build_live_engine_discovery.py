"""The reviewed live four-entry successor; no core import or effectful calls."""
import argparse
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026-11-10.v2'
FORMAT = 'aap-hosted-engine-observation/' + VERSION
PROFILE = 'urn:aap:hosted-engine-mcp:0.1'
ORIGIN = 'https://jupie202020.pythonanywhere.com'
ENDPOINT = ORIGIN + '/mcp/engine/v1'
WEBSITE = 'https://covenant-common.github.io/covenant-docs'
SOURCE = ROOT / ('distribution/engine-mcp-observation-' + VERSION + '.json')
HISTORY = ROOT / 'distribution/history/public-discovery-2026-11-02.v1'
INVENTORY = 'mcp/engine-tool-inventory-' + VERSION + '.json'
ENTRY = ('covenant_onboard', 'covenant_find', 'covenant_explain', 'covenant_call')
PINS = {
    'tools': '6d739ec80e85ef0498bccd82840fc8506b0dee07ec9c55b11f668cffef39a628',
    'serverCard': 'ab696a0b983a3937e2080826969cdf8ab76045635e7e4806c1b1ed7dda5303b9',
    'engine': '5bce39271ae34f3bff519a1a21382cfa253e25b2f32636b8f77a0521bce5fe30'}
# These pins cover the canonical public observation from 14 November 2026.
# Its tool rows were also compared with the installed f6 build.
SUCCESSOR_VERSION = '2026-11-14.f6.v1'
SUCCESSOR_RUNTIME = '0.2'
SUCCESSOR_PINS = {
    'tools': '77d9411e8b3b65ba000433d07a0b0c7b4446f1e06a8d3d2a57918d8c16cd6e57',
    'serverCard': 'cff8d04c53cb233b84b558510920202f423e714e5697e1bb6f97e30c19dbca4f',
    'engine': 'e64b3261920c9a4b7a8ac296d232a465e58d745bab39d099876688b92faef980',
    'observation': 'd6c3111cf7a683e54c8d4463bff2dd1c9fb6ba5e796c1315cd3e7a788b6db954',
}
HIRING_VERSION = '2026-11-14.d25.v1'
HIRING_PINS = None
ENTRY_PROFILES = (VERSION, SUCCESSOR_VERSION, HIRING_VERSION)
ACTIVE_VERSION = SUCCESSOR_VERSION
PROTOCOL = '2025-11-25'
META = 'io.github.covenant-common/aap'
ALIASES = [ORIGIN + '/mcp', ORIGIN + '/mcp/agent/v1']
ENGINE_FIELDS = ('profile', 'url', 'api_call', 'reference', 'entry_tools',
                 'keyless_actions', 'public_tools', 'account_tools', 'fixed_public_tools',
                 'account_authentication', 'keys_accepted', 'catalogue')


def wire(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + '\n').encode('ascii')


@dataclass(frozen=True)
class LiveProfile:
    version: str
    runtime_version: str
    pins: dict

    @property
    def profile(self):
        return 'urn:aap:hosted-engine-mcp:' + self.runtime_version

    @property
    def observation(self):
        return ROOT / ('distribution/engine-mcp-observation-' + self.version + '.json')

    @property
    def inventory(self):
        return 'mcp/engine-tool-inventory-' + self.version + '.json'


def reviewed_profile(version):
    if version == VERSION:
        return LiveProfile(VERSION, '0.1', PINS)
    pins = {SUCCESSOR_VERSION: SUCCESSOR_PINS, HIRING_VERSION: HIRING_PINS}.get(version)
    if pins is None:
        raise ValueError('The selected observation is awaiting explicit review pins')
    if (set(pins) != set(PINS) | {'observation'} or
            not all(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value)
                    for value in pins.values())):
        raise ValueError('Review pins must cover the observation, tool list, server card and engine projection')
    return LiveProfile(version, SUCCESSOR_RUNTIME, pins)


def _validate_shape(source, version, runtime_version):
    profile = 'urn:aap:hosted-engine-mcp:' + runtime_version
    identity = {'name': 'aap-engine', 'version': runtime_version}
    if (source.get('format') != 'aap-hosted-engine-observation/' + version or
            source.get('profile') != profile or source.get('endpoint') != ENDPOINT or
            source.get('protocolVersion') != PROTOCOL or source.get('serverInfo') != identity or
            source.get('endpointAliases') != ALIASES):
        raise ValueError('Observed connection identity, profile, protocol and aliases must agree')
    try:
        card = source['serverCard']
        meta = card['_meta'][META]
        tools = source['tools']
        engine = {field: meta[field] for field in ENGINE_FIELDS}
        valid = (meta['serverInfo'] == identity and card['version'] == runtime_version and
                 card['remotes'][0]['url'] == ENDPOINT and meta['entry_tool_schemas'] == tools and
                 tuple(row['name'] for row in tools) == ENTRY and source['engine'] == engine and
                 engine['profile'] == profile and engine['entry_tools'] == list(ENTRY))
    except (KeyError, TypeError, IndexError) as error:
        raise ValueError('Incomplete live server card or tool list') from error
    if not valid:
        raise ValueError('Observed server card, tool schemas and engine projection must agree')


def review_pins(source):
    return {field: hashlib.sha256(wire(source[field])).hexdigest() for field in PINS}


def validate(source, version=VERSION):
    selected = reviewed_profile(version)
    _validate_shape(source, selected.version, selected.runtime_version)
    for field, pin in review_pins(source).items():
        if pin != selected.pins[field]:
            raise ValueError('Observed engine drift in ' + field + '; review a versioned successor')
    return source


def documents(source, version=VERSION):
    selected = reviewed_profile(version)
    validate(source, selected.version)
    if ('observation' in selected.pins and
            selected.pins['observation'] != hashlib.sha256(wire(source)).hexdigest()):
        raise ValueError('Retained successor observation differs from the reviewed record')
    inventory = {'format': 'aap-hosted-engine-tool-inventory/' + selected.version,
        'profile': selected.profile, 'endpoint': ENDPOINT, 'endpointAliases': source['endpointAliases'],
        'observedAt': source['observedAt'], 'protocolVersion': source['protocolVersion'],
        'serverInfo': source['serverInfo'], 'toolCount': len(ENTRY),
        'tools': deepcopy(source['tools']), 'engine': deepcopy(source['engine']),
        'sourceEvidence': deepcopy(source['sourceEvidence']),
        'liveAuthority': 'Discover current schemas with tools/list; use covenant_explain for the selected action.',
        'scope': 'Four entry tools. Keyless actions need no account; account writes require current scoped permission. Every maintained family is discoverable, not anonymously callable.',
        'privacyBoundary': 'The host receives supplied parameters. Keep private inputs, proving witnesses and commitment openings local; send only shareable proof envelopes and records.',
        'planningBoundary': 'Templates and plans remain unsigned and unadopted. Group preparation does not create a forum.',
        'signingKeysAccepted': False, 'legacyPublicNamesRemainCallable': True}
    body = wire(inventory)
    card = deepcopy(source['serverCard'])
    card['_meta']['io.github.covenant-common/public-tools'] = {
        'profileVersion': selected.version, 'url': WEBSITE + '/' + selected.inventory,
        'toolCount': len(ENTRY), 'names': list(ENTRY), 'observedAt': source['observedAt'],
        'sha256': hashlib.sha256(body).hexdigest(), 'snapshotOnly': True,
        'currentListingMethod': 'tools/list',
        'fullSchemaLookup': {'tool': 'covenant_explain', 'arguments': {'tool': 'covenant_offline__spec'}}}
    card['websiteUrl'] = WEBSITE + '/docs/API_MCP.html#engine'
    card_bytes = wire(card)
    catalog = {'specVersion': '1.0', 'host': {'displayName': 'Covenant',
        'documentationUrl': WEBSITE + '/docs/API_MCP.html#engine'}, 'entries': [{
        'identifier': 'urn:air:jupie202020.pythonanywhere.com:mcp:aap-engine',
        'displayName': 'Covenant engine', 'type': 'application/mcp-server-card+json', 'data': card}]}
    api = {'linkset': [
        {'anchor': ORIGIN + '/.well-known/api-catalog', 'item': [{'href': ENDPOINT}]},
        {'anchor': ENDPOINT, 'service-doc': [{'href': WEBSITE + '/docs/API_MCP.html#engine', 'type': 'text/html'}],
         'describedby': [{'href': ORIGIN + '/mcp/server-card', 'type': 'application/mcp-server-card+json'}]}]}
    auth = ('# Covenant engine access\n\nEngine MCP: ' + ENDPOINT + '\n'
        'Aliases: ' + ORIGIN + '/mcp and ' + ORIGIN + '/mcp/agent/v1\n\n'
        'Start with covenant_onboard, covenant_find, covenant_explain and covenant_call. '
        'Discovery and reviewed keyless actions need no account, token or API key. '
        'Use Streamable HTTP and MCP 2025-11-25. Refresh tools/list and inspect the selected action schema.\n\n'
        'covenant_call can route account writes. Those actions require your current scoped bearer grant, '
        'checked again on every request. Set it only in private client credential settings. '
        'No OAuth issuer is advertised. Connecting creates no account or signing or spending authority. '
        'Keep private signing keys out of requests. Existing signatures and idempotency rules still apply.\n\n'
        'All 205 maintained families are discoverable. Some require owner setup, external providers, '
        'hardware or SDK access, or remain unresolved. A directory entry does not enable them. '
        'The four entry tools expose schemas and access routes. Sandbox actions execute only at '
        '/mcp/sandbox/v1 with separate role-scoped test tokens and fictional balances.\n\n'
        'The hosted service receives the parameters sent in each call. Keep private inputs, '
        'proving witnesses and commitment openings in reviewed local tools; share only intended '
        'proof envelopes and records. Templates and plans remain unsigned and unadopted. '
        'Group preparation does not create a forum.\n\n'
        'The original nine public action names remain callable. Historical schemas: ' + WEBSITE +
        '/distribution/history/public-discovery-2026-11-02.v1/mcp/tool-inventory.json\n\n'
        'Connection guide: ' + WEBSITE + '/docs/API_MCP.html#engine\nPrivacy: ' + WEBSITE + '/PRIVACY.html\n')
    return {'mcp/server-card': ('application/mcp-server-card+json', card_bytes),
        '.well-known/mcp/server-card.json': ('application/mcp-server-card+json', card_bytes),
        '.well-known/ai-catalog.json': ('application/ai-catalog+json', wire(catalog)),
        '.well-known/api-catalog': ('application/linkset+json', wire(api)),
        'mcp/tool-inventory.json': ('application/json', body),
        selected.inventory: ('application/json', body),
        'auth.md': ('text/markdown; charset=utf-8', auth.encode('utf-8'))}


def _capture(version, runtime_version):
    """Exactly three bounded anonymous requests; no tools/call or redirects."""
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, new_url):
            return None
    opener = build_opener(NoRedirect())
    captures = {}
    def fetch(label, url, packet=None):
        request = Request(url, data=None if packet is None else wire(packet), headers={
            'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
            'MCP-Protocol-Version': PROTOCOL}, method='GET' if packet is None else 'POST')
        with opener.open(request, timeout=30) as response:
            if response.geturl() != url or response.status != 200:
                raise ValueError('Unexpected engine discovery response')
            raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError('Engine metadata exceeds the bounded capture size')
        captures[label] = hashlib.sha256(raw).hexdigest()
        value = json.loads(raw)
        if packet is not None:
            if value.get('id') != packet['id'] or 'error' in value:
                raise ValueError('Engine MCP discovery did not complete')
            return value['result']
        return value
    card = fetch('server-card', ORIGIN + '/.well-known/mcp/server-card.json')
    initial = fetch('initialize', ENDPOINT, {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
        'params': {'protocolVersion': PROTOCOL, 'capabilities': {},
                   'clientInfo': {'name': 'covenant-engine-discovery', 'version': version}}})
    listing = fetch('tools/list', ENDPOINT, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}})
    if listing.get('nextCursor'):
        raise ValueError('Review the complete inventory before publication')
    try:
        meta = card['_meta'][META]
        engine = {field: deepcopy(meta[field]) for field in ENGINE_FIELDS}
    except (KeyError, TypeError) as error:
        raise ValueError('Incomplete live server-card projection') from error
    source = {'format': 'aap-hosted-engine-observation/' + version,
        'profile': 'urn:aap:hosted-engine-mcp:' + runtime_version, 'endpoint': ENDPOINT,
        'endpointAliases': ALIASES,
        'observedAt': datetime.now(timezone.utc).isoformat(),
        'protocolVersion': initial['protocolVersion'], 'serverInfo': initial['serverInfo'],
        'tools': listing['tools'], 'serverCard': card,
        'engine': engine,
        'method': 'Anonymous GET server card, MCP initialize and tools/list only; no tools/call',
        'sourceEvidence': {'rawResponseSha256': captures, 'runtimeCommitVerifiedByThisCapture': False}}
    _validate_shape(source, version, runtime_version)
    return source


def observe(version=VERSION):
    selected = reviewed_profile(version)
    return validate(_capture(version, selected.runtime_version), version)


def check_hiring_candidate(previous, source):
    """Require exactly the expected account-only change before printing candidate pins."""
    _validate_shape(source, HIRING_VERSION, SUCCESSOR_RUNTIME)
    old_engine = previous['engine']
    changed = deepcopy(old_engine)
    changed['account_tools'] += 6
    catalogue = changed['catalogue']
    catalogue['mounted_descriptors_by_interface']['account'] += 6
    catalogue['browsable_names'] += 6
    if source['engine'] != changed:
        raise ValueError('Unexpected engine projection drift in the hiring candidate')
    expected_card = deepcopy(previous['serverCard'])
    expected_card['_meta'][META].update(changed)
    if (source['serverCard'] != expected_card or
            any(source[field] != previous[field] for field in ('tools', 'serverInfo', 'protocolVersion'))):
        raise ValueError('Unexpected card or public schema drift in the hiring candidate')


def capture_successor_for_review(path, version=SUCCESSOR_VERSION):
    if version not in (SUCCESSOR_VERSION, HIRING_VERSION):
        raise ValueError('Choose a configured public observation version')
    target = Path(path).absolute()
    if target.resolve().is_relative_to(ROOT.resolve()) or target.exists() or target.is_symlink():
        raise ValueError('Choose a new capture file outside the public-site checkout')
    source = _capture(version, SUCCESSOR_RUNTIME)
    with target.open('xb') as out:
        out.write(wire(source))
    if version == HIRING_VERSION:
        earlier = reviewed_profile(SUCCESSOR_VERSION)
        previous = json.loads(earlier.observation.read_bytes())
        documents(previous, earlier.version)
        check_hiring_candidate(previous, source)
    return {'status': 'CAPTURED_FOR_REVIEW', 'file': str(target),
            'profileVersion': version,
            'candidatePins': {**review_pins(source), 'observation': hashlib.sha256(wire(source)).hexdigest()},
            'runtimeCommitVerifiedByThisCapture': False}


def main():
    parser = argparse.ArgumentParser(description='Capture the future 0.2 observation for separate review.')
    parser.add_argument('--capture-for-review', type=Path, required=True)
    parser.add_argument('--profile', choices=(SUCCESSOR_VERSION, HIRING_VERSION), default=SUCCESSOR_VERSION)
    args = parser.parse_args()
    try:
        print(json.dumps(capture_successor_for_review(args.capture_for_review, args.profile), indent=2))
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, 'FAIL: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
