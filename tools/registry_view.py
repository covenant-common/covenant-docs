"""Read the server capability registry and the docs projection of it.

The server file is ``covenant_chain/data/capability_registry.json`` in
covenant-common/covenant (draft PR 200). This environment cannot read that
private file. ``normalize`` accepts the docs projection and a nested server
document that names tools and payment methods. An unrecognised document fails
with its top-level keys instead of being guessed.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECTION = ROOT / 'distribution' / 'capability-registry.json'
SERVER_COPY = ROOT / 'distribution' / 'capability-registry.server.json'
SERVER_PATH = 'covenant_chain/data/capability_registry.json'
SERVER_REPO = 'covenant-common/covenant'
SERVER_PR = 201
RELATED_PR = 192
TOOL_NAME = re.compile(r'^(?:aap_public_[a-z0-9_]+|covenant_[a-z0-9_]+)$')
STATUS_WORDS = {
    'live': 'Live',
    'test': 'Test mode',
    'test_mode': 'Test mode',
    'sandbox': 'Test mode',
    'library': 'Library only',
    'library_only': 'Library only',
    'planned': 'Planned',
    'not_planned': 'Not planned',
}
TOOL_KEYS = ('public_tools', 'tools', 'tool_names', 'names', 'entries', 'sandbox_tools')
PAYMENT_KEYS = ('payments', 'methods', 'payment_methods', 'rails', 'settlement_rails')
BADGES = {
    'NOT_CONNECTED': 'Not connected',
    'CONFIGURED_UNVERIFIED': 'Configured, not yet verified',
    'TEST_ONLY': 'Test only',
    'NOT_LIVE': 'Not live',
    'COMING_SOON': 'Coming soon',
    'LIVE': 'Live',
}


def load_json(path):
    return json.loads(Path(path).read_text())


def _nodes(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from _nodes(item)
    elif isinstance(value, list):
        for item in value:
            yield from _nodes(item)


def _tool_names(seq):
    names = []
    for item in seq:
        if isinstance(item, str) and TOOL_NAME.match(item):
            names.append(item)
        elif isinstance(item, dict):
            for key in ('name', 'id', 'tool', 'tool_name'):
                candidate = item.get(key)
                if isinstance(candidate, str) and TOOL_NAME.match(candidate):
                    names.append(candidate)
                    break
    ordered = []
    for name in names:
        if name not in ordered:
            ordered.append(name)
    return ordered


def find_tools(doc):
    best = []
    for node in _nodes(doc):
        if not isinstance(node, dict):
            continue
        for key in TOOL_KEYS:
            if isinstance(node.get(key), list):
                found = _tool_names(node[key])
                if len(found) > len(best):
                    best = found
    return best


def _method_list(seq):
    rows = []
    for item in seq:
        if isinstance(item, dict) and isinstance(item.get('id'), str) and (
                'readiness' in item or 'badge' in item or 'settlement_enabled' in item
                or 'state' in item or 'availability' in item or 'can_settle' in item):
            rows.append(item)
    return rows


def find_payments(doc):
    best = []
    for node in _nodes(doc):
        if isinstance(node, dict):
            for key in PAYMENT_KEYS:
                value = node.get(key)
                if isinstance(value, list):
                    found = _method_list(value)
                    if len(found) > len(best):
                        best = found
                elif isinstance(value, dict) and isinstance(value.get('methods'), list):
                    found = _method_list(value['methods'])
                    if len(found) > len(best):
                        best = found
        elif isinstance(node, list):
            found = _method_list(node)
            if len(found) > len(best):
                best = found
    return best


def _is_projection(doc):
    return isinstance(doc, dict) and isinstance(doc.get('public_tools'), list) and isinstance(doc.get('payments'), list) and isinstance(doc.get('badges'), dict)


def status_word(value):
    if not isinstance(value, str):
        return None
    key = value.strip().lower().replace(' ', '_').replace('-', '_')
    if value in ('Live', 'Test mode', 'Sandbox', 'Library only', 'Planned', 'Not planned'):
        return value
    return STATUS_WORDS.get(key)


def find_standards(doc):
    rows = []
    for node in _nodes(doc):
        if not isinstance(node, dict):
            continue
        for key in ('standards', 'features', 'sandbox_features'):
            value = node.get(key)
            seq = value.values() if isinstance(value, dict) else value if isinstance(value, list) else None
            if seq is None:
                continue
            for item in seq:
                if isinstance(item, dict) and isinstance(item.get('id'), str):
                    word = status_word(item.get('status') or item.get('mode') or item.get('availability'))
                    if word:
                        rows.append({'id': item['id'], 'status': word, 'name': item.get('name') or item['id']})
    ordered = []
    seen = set()
    for row in rows:
        if row['id'] not in seen:
            seen.add(row['id'])
            ordered.append(row)
    return ordered


def _plain(row):
    for key in ('plain', 'summary', 'readiness_label', 'description'):
        if isinstance(row.get(key), str) and row[key].strip():
            return row[key].strip()
    readiness = row.get('readiness') or row.get('status') or ''
    return BADGES.get(readiness, str(readiness))


def _badge(row):
    if isinstance(row.get('badge'), str) and row['badge'] in BADGES:
        return row['badge']
    readiness = row.get('readiness') or row.get('state') or row.get('status') or row.get('availability')
    if row.get('id') == 'card' and readiness == 'NOT_CONNECTED':
        return 'COMING_SOON'
    if readiness in BADGES:
        return readiness
    raise ValueError('payment method %s has no recognised readiness' % row.get('id'))


def normalize(doc):
    """Return the docs projection. A docs projection passes through."""
    if not isinstance(doc, dict):
        raise ValueError('capability registry must be a JSON object')
    if _is_projection(doc):
        return doc
    tool_source = 'document'
    listed = doc.get('public_tools_list')
    if isinstance(listed, list) and _tool_names(listed):
        tools = _tool_names(listed)
        tool_source = 'public_tools_list'
    else:
        tools = find_tools(doc)
    mode = doc.get('public_tools') if isinstance(doc.get('public_tools'), str) else None
    if mode and not tools:
        tools = tool_names_from_card()
        tool_source = 'server-card'
    payments = find_payments(doc)
    recognised = mode or isinstance(doc.get('sandbox'), dict) or 'methods' in doc or 'payment_methods' in doc or 'public_tools_list' in doc
    if not tools or not payments:
        if not recognised:
            raise ValueError(shape_error(doc))
        raise ValueError(shape_error(doc))
    first = doc.get('first_public_tool') or doc.get('first_tool')
    if not isinstance(first, str) or first not in tools:
        first = 'covenant_contract__draft' if 'covenant_contract__draft' in tools else tools[0]
    lifecycle = None
    for node in _nodes(doc):
        if isinstance(node, dict) and isinstance(node.get('states'), list) and node['states']:
            lifecycle = {'scope': node.get('scope') or 'Server capability registry.', 'states': list(node['states'])}
            break
    return {
        'format': 'covenant-docs-capability-registry/0.1',
        'source_path': SERVER_PATH,
        'source_repo': SERVER_REPO,
        'source_pr': SERVER_PR,
        'related_pr': RELATED_PR,
        'public_tools': tools,
        'public_tools_mode': mode,
        'tool_name_source': tool_source,
        'can_pay': doc.get('can_pay', False),
        'can_sign': doc.get('can_sign', False),
        'can_refund': doc.get('can_refund', False),
        'can_dispute': doc.get('can_dispute', False),
        'custody': doc.get('custody'),
        'holds_funds': doc.get('holds_funds', False),
        'merchant_of_record': doc.get('merchant_of_record'),
        'sandbox': {'works_in_test': sandbox_works(doc)},
        'first_public_tool': first,
        'badges': dict(BADGES),
        'payments': [{
            'id': row['id'],
            'label': row.get('label') or row['id'],
            'readiness': row.get('readiness') or row.get('state') or row.get('status') or row.get('availability'),
            'badge': _badge(row),
            'settlement_enabled': bool(row.get('settlement_enabled') or row.get('executable') or row.get('can_settle')),
            'plain': _plain(row),
        } for row in payments],
        'standards_from_server': find_standards(doc),
        'lifecycle': lifecycle,
    }


def shape_error(doc):
    keys = ', '.join(sorted(doc)) if isinstance(doc, dict) else type(doc).__name__
    return 'unrecognised shape: keys ' + keys


def tool_names_from_card(path=None):
    card_path = Path(path) if path else ROOT / '.well-known' / 'mcp' / 'server-card.json'
    if not card_path.is_file():
        return []
    try:
        card = json.loads(card_path.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    meta = ((card.get('_meta') or {}).get('io.github.covenant-common/public-tools') or {})
    return _tool_names(meta.get('names') or [])


def sandbox_works(doc):
    sandbox = doc.get('sandbox') if isinstance(doc, dict) else None
    if not isinstance(sandbox, dict):
        return []
    works = sandbox.get('works_in_test') or []
    if isinstance(works, dict):
        return [key for key, value in works.items() if value]
    if isinstance(works, list):
        names = []
        for item in works:
            if isinstance(item, str):
                names.append(item)
            elif isinstance(item, dict) and isinstance(item.get('id'), str):
                names.append(item['id'])
        return names
    return []


def apply_works_in_test(standards, works):
    known = set(works or [])
    rows = []
    for row in standards:
        item = dict(row)
        ids = set(item.get('sandbox_ids') or [])
        ids.add(item.get('id'))
        if item.get('id') == 'mcp-2026-07-28':
            ids.add('server/discover')
        if ids & known:
            item['status'] = 'Test mode'
            if item.get('id') == 'mcp-2026-07-28':
                item['where'] = 'server/discover is offered in the server sandbox in test. The public host still speaks MCP 2025-11-25.'
            elif item.get('id') in ('release', 'refund'):
                item['where'] = 'Moves test money in the server sandbox. Not real funds, and not Live.'
        elif item.get('id') == 'reclaim':
            item['status'] = 'Planned'
            item['where'] = 'Not in sandbox.works_in_test.'
        rows.append(item)
    return rows


def server_registry_errors(path=SERVER_COPY):
    """Fail closed when PR 201's registry is absent or not a known shape."""
    if not Path(path).is_file():
        return ['unrecognised shape: keys (registry file is not in the checkout)']
    try:
        raw = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return ['unreadable server registry: ' + str(exc)]
    try:
        normalize(raw)
    except ValueError as exc:
        return [str(exc)]
    return []


def projection_source_ok(doc):
    path = doc.get('source_path') or (doc.get('source') or {}).get('path')
    return path == SERVER_PATH
