"""The reviewed live four-entry successor; no core import or effectful calls."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
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
ENGINE_FIELDS = ('profile', 'url', 'api_call', 'reference', 'entry_tools',
                 'keyless_actions', 'public_tools', 'account_tools', 'fixed_public_tools',
                 'account_authentication', 'keys_accepted', 'catalogue')


def wire(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True, indent=2) + '\n').encode('ascii')


def validate(source):
    if (source.get('format') != FORMAT or source.get('profile') != PROFILE or
            source.get('endpoint') != ENDPOINT or source.get('protocolVersion') != '2025-11-25'):
        raise ValueError('Only the explicitly reviewed live engine profile is supported')
    for field, pin in PINS.items():
        if hashlib.sha256(wire(source.get(field))).hexdigest() != pin:
            raise ValueError('Observed engine drift in ' + field + '; review a versioned successor')
    meta = source['serverCard']['_meta']['io.github.covenant-common/aap']
    if (source.get('serverInfo') != meta['serverInfo'] or
            source['tools'] != meta['entry_tool_schemas'] or
            tuple(row['name'] for row in source['tools']) != ENTRY or
            source.get('endpointAliases') != [ORIGIN + '/mcp', ORIGIN + '/mcp/agent/v1']):
        raise ValueError('Observed connection identity, aliases and complete schemas must agree')
    return source


def documents(source):
    validate(source)
    inventory = {'format': 'aap-hosted-engine-tool-inventory/' + VERSION,
        'profile': PROFILE, 'endpoint': ENDPOINT, 'endpointAliases': source['endpointAliases'],
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
        'profileVersion': VERSION, 'url': WEBSITE + '/' + INVENTORY,
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
        INVENTORY: ('application/json', body),
        'auth.md': ('text/markdown; charset=utf-8', auth.encode('utf-8'))}


def observe():
    """Exactly three bounded anonymous requests; no tools/call or redirects."""
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, new_url):
            return None
    opener = build_opener(NoRedirect())
    captures = {}
    def fetch(label, url, packet=None):
        request = Request(url, data=None if packet is None else wire(packet), headers={
            'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-11-25'}, method='GET' if packet is None else 'POST')
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
        'params': {'protocolVersion': '2025-11-25', 'capabilities': {},
                   'clientInfo': {'name': 'covenant-engine-discovery', 'version': VERSION}}})
    listing = fetch('tools/list', ENDPOINT, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}})
    if listing.get('nextCursor'):
        raise ValueError('Review the complete inventory before publication')
    meta = card['_meta']['io.github.covenant-common/aap']
    return validate({'format': FORMAT, 'profile': PROFILE, 'endpoint': ENDPOINT,
        'endpointAliases': [ORIGIN + '/mcp', ORIGIN + '/mcp/agent/v1'],
        'observedAt': datetime.now(timezone.utc).isoformat(),
        'protocolVersion': initial['protocolVersion'], 'serverInfo': initial['serverInfo'],
        'tools': listing['tools'], 'serverCard': card,
        'engine': {field: deepcopy(meta[field]) for field in ENGINE_FIELDS},
        'method': 'Anonymous GET server card, MCP initialize and tools/list only; no tools/call',
        'sourceEvidence': {'rawResponseSha256': captures, 'runtimeCommitVerifiedByThisCapture': False}})
