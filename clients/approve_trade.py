#!/usr/bin/env python3
"""Review one complete direct-party agreement and approve one exact action offline.

Python 3.10+, macOS/Linux, cryptography. No network or Covenant core imports.
Independent public wire-format implementation; file-safety helpers are reused
from this repository's MIT-licensed approve_listing.py. Ed25519 signing and
verification use cryptography. Point admission uses public RFC8032 arithmetic;
no secret arithmetic or alternative signature algorithm is implemented.
"""
import argparse
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

ORIGIN = 'https://jupie202020.pythonanywhere.com'
ACCESS_VERSION = 'aap-private-trial-client/0.1'
PROFILE = 'urn:aap:reciprocal-trade:0.1'
TERMS = 'AAP-RECIPROCAL-TRADE-TERMS-0.1'
ASSENT = 'AAP-RECIPROCAL-TRADE-ASSENT-0.1'
EVENT = 'AAP-RECIPROCAL-TRADE-EVENT-0.1'
LEG = 'AAP-RECIPROCAL-TRADE-LEG-0.1'
USDC = 'urn:aap:hosted-usdc-payment:0.1'
HEX = re.compile(r'[0-9a-f]{64}\Z')
SHORT = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}\Z')
MAX_SAFE_INTEGER = 2**53 - 1
ACCESS_FIELDS = frozenset(('version','origin','actor','private_seed','token',
    'client_nonce','challenge','signature','grant'))
TOKENS = {'eip155:1':'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    'eip155:8453':'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'}

class Refused(ValueError):
    """Only fixed local codes, never supplied values or raw exceptions."""


def require(value, code):
    if not value:
        raise Refused(code)


def shape(value, fields, code):
    require(type(value) is dict and set(value) == set(fields), code)


def hex_key(value):
    return type(value) is str and HEX.fullmatch(value) is not None


def integer(value, positive=False):
    return type(value) is int and (1 if positive else 0) <= value <= MAX_SAFE_INTEGER


def canonical(value):
    """Sorted compact JSON; exact booleans, safe integers and printable ASCII."""
    pending, visited = [(value, 0)], 0
    while pending:
        item, depth = pending.pop()
        visited += 1
        require(depth <= 40 and visited <= 20000, 'JSON_BOUNDS')
        if item is None or type(item) is bool:
            continue
        if type(item) is int:
            require(abs(item) <= MAX_SAFE_INTEGER, 'JSON_INTEGER')
        elif type(item) is str:
            require(len(item) <= 100000 and all(32 <= ord(c) <= 126 for c in item), 'JSON_ASCII')
        elif type(item) is list:
            require(len(item) <= 20000, 'JSON_BOUNDS')
            pending.extend((part, depth + 1) for part in item)
        elif type(item) is dict:
            require(len(item) <= 20000, 'JSON_BOUNDS')
            for name, part in item.items():
                require(type(name) is str and len(name) <= 256 and
                    all(32 <= ord(c) <= 126 for c in name), 'JSON_KEY')
                pending.append((part, depth + 1))
        else:
            raise Refused('JSON_TYPE')
    return json.dumps(value, ensure_ascii=True, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode('ascii')


def decode(raw):
    def unique(pairs):
        result = {}
        for name, value in pairs:
            require(name not in result, 'JSON_DUPLICATE_KEY')
            result[name] = value
        return result
    def invalid(unused):
        raise Refused('JSON_NUMBER')
    try:
        result = json.loads(raw.decode('utf-8'), object_pairs_hook=unique,
            parse_float=invalid, parse_constant=invalid)
        canonical(result)
        return result
    except Refused:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise Refused('JSON_INVALID') from None


def fingerprint(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_nlink,
            info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def open_parent(path):
    """Walk by directory handles so no path component follows a symlink."""
    path = Path(path).expanduser().absolute()
    require(path.name not in ('', '.', '..') and '..' not in path.parts, 'FILE_PATH')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for name in path.parent.parts[1:]:
            child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd, path.name
    except BaseException:
        os.close(fd)
        raise


def read_document(path, maximum):
    parent, name = open_parent(path)
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        try:
            before = os.fstat(fd)
            require(stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid() and
                before.st_nlink == 1 and stat.S_IMODE(before.st_mode) == 0o600 and
                0 < before.st_size <= maximum, 'PRIVATE_INPUT_FILE')
            parts, count = [], 0
            while count <= maximum:
                part = os.read(fd, min(8192, maximum + 1 - count))
                if not part:
                    break
                parts.append(part)
                count += len(part)
            require(count == before.st_size and fingerprint(os.fstat(fd)) == fingerprint(before)
                and fingerprint(os.stat(name, dir_fd=parent, follow_symlinks=False)) == fingerprint(before),
                'INPUT_CHANGED')
            value = decode(b''.join(parts))
            return value, fingerprint(before)
        finally:
            os.close(fd)
    finally:
        os.close(parent)


def unchanged(path, expected):
    parent, name = open_parent(path)
    try:
        require(fingerprint(os.stat(name, dir_fd=parent, follow_symlinks=False)) == expected,
            'INPUT_CHANGED')
    finally:
        os.close(parent)


def new_output(path, value):
    parent, name = open_parent(path)
    fd, identity = None, None
    try:
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600,
            dir_fd=parent)
        os.fchmod(fd, 0o600)
        identity = (os.fstat(fd).st_dev, os.fstat(fd).st_ino)
        raw = canonical(value) + b'\n'
        with os.fdopen(fd, 'wb') as output:
            fd = None
            output.write(raw)
            output.flush()
            os.fsync(output.fileno())
        info = os.stat(name, dir_fd=parent, follow_symlinks=False)
        require((info.st_dev, info.st_ino) == identity and stat.S_ISREG(info.st_mode) and
            info.st_uid == os.getuid() and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o600 and info.st_size == len(raw), 'OUTPUT_FILE')
        os.fsync(parent)
        identity = None
    finally:
        if fd is not None:
            os.close(fd)
        if identity is not None:
            try:
                current = os.stat(name, dir_fd=parent, follow_symlinks=False)
                if (current.st_dev, current.st_ino) == identity:
                    os.unlink(name, dir_fd=parent)
            except FileNotFoundError:
                pass
        os.close(parent)



def digest(label, value):
    return hashlib.sha256(label.encode('ascii') + b'\0' + canonical(value)).hexdigest()


def message(label, value):
    return label.encode('ascii') + b'\0' + canonical(value)


def text(value, maximum=256):
    require(type(value) is str and 0 < len(value) <= maximum, 'TEXT')


@lru_cache(maxsize=256)
def party(encoded):
    """Admit canonical on-curve, non-small-order public points (RFC8032)."""
    require(hex_key(encoded), 'DIRECT_ED25519_PARTY_REQUIRED')
    field = 2**255 - 19
    encoded_number = int.from_bytes(bytes.fromhex(encoded), 'little')
    y, parity = encoded_number & (2**255 - 1), encoded_number >> 255
    require(y < field, 'PUBLIC_KEY')
    d = (-121665 * pow(121666, -1, field)) % field
    denominator = (d*y*y+1) % field
    require(denominator != 0, 'PUBLIC_KEY')
    square = (y*y-1) * pow(denominator, -1, field) % field
    x = pow(square, (field+3)//8, field)
    if x*x % field != square:
        x = x * pow(2, (field-1)//4, field) % field
    require(x*x % field == square and not (x == 0 and parity), 'PUBLIC_KEY')
    if x % 2 != parity:
        x = field-x
    # Only public point admission: three doublings test the cofactor subgroup.
    for unused in range(3):
        mixed = d*x*x*y*y % field
        require((1+mixed) % field != 0 and (1-mixed) % field != 0, 'PUBLIC_KEY')
        x, y = (2*x*y * pow((1+mixed) % field, -1, field) % field,
            (y*y+x*x) * pow((1-mixed) % field, -1, field) % field)
    require((x,y) != (0,1), 'PUBLIC_KEY')
    return encoded


def verify(actor, label, body, signature):
    party(actor)
    require(type(signature) is str and re.fullmatch(r'[0-9a-f]{128}',signature), 'SIGNATURE_ENCODING')
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(actor)).verify(
            bytes.fromhex(signature), message(label,body))
    except (ValueError, InvalidSignature):
        raise Refused('SIGNATURE_INVALID') from None


def checked_terms(body):
    shape(body, ('profile','parties','legs','nonce','context','previous'), 'TERMS_FIELDS')
    require(body['profile'] == PROFILE and hex_key(body['nonce']) and
        (body['previous'] is None or hex_key(body['previous'])), 'TERMS_PROFILE')
    parties = body['parties']
    require(type(parties) is list and 2 <= len(parties) <= 16 and
        len(set(canonical(p) for p in parties)) == len(parties), 'PARTIES')
    for actor in parties:
        party(actor)
    require(len(canonical(body['context'])) <= 8192 and len(canonical(body)) <= 32768, 'TERMS_SIZE')
    rows = body['legs']
    require(type(rows) is list and 1 <= len(rows) <= 32, 'LEGS')
    known, involved = {}, set()
    for row in rows:
        shape(row, ('id','debtor','creditor','resource','amount','mechanism',
            'evidence_policy','depends_on','due_at'), 'LEG_FIELDS')
        require(type(row['id']) is str and SHORT.fullmatch(row['id']) and row['id'] not in known,
            'LEG_ID')
        require(row['debtor'] in parties and row['creditor'] in parties and
            row['debtor'] != row['creditor'], 'LEG_PARTIES')
        involved.update((row['debtor'],row['creditor']))
        amount = row['amount']
        require(type(amount) is str and re.fullmatch(r'[1-9][0-9]{0,255}',amount), 'AMOUNT_UNITS')
        asset = row['resource']
        shape(asset, ('kind','identifier','unit','scale','network','metadata'), 'RESOURCE_FIELDS')
        require(asset['kind'] in ('CRYPTO','FIAT','PHYSICAL','SERVICE','CUSTOM') and
            integer(asset['scale']) and asset['scale'] <= 36 and
            len(canonical(asset['metadata'])) <= 4096, 'RESOURCE')
        for name in ('identifier','unit','network'):
            text(asset[name])
        mechanism = row['mechanism']
        shape(mechanism, ('identifier','adapter','request_hash'), 'MECHANISM_FIELDS')
        text(mechanism['identifier'])
        require((mechanism['adapter'] is None and mechanism['request_hash'] is None) or
            hex_key(mechanism['adapter']) and hex_key(mechanism['request_hash']), 'MECHANISM')
        policy = row['evidence_policy']
        shape(policy, ('mode','verifier','finality','minimum_confirmations'), 'EVIDENCE_FIELDS')
        text(policy['finality'])
        require(integer(policy['minimum_confirmations']), 'CONFIRMATIONS')
        require((policy['mode'] == 'RECIPIENT_ACCEPTANCE' and policy['verifier'] is None and
            policy['minimum_confirmations'] == 0) or
            (policy['mode'] == 'OWNER_VERIFIER' and hex_key(policy['verifier'])), 'EVIDENCE_POLICY')
        depends = row['depends_on']
        require(type(depends) is list and len(depends) <= 31 and
            all(type(ref) is str and SHORT.fullmatch(ref) for ref in depends) and
            len(set(depends)) == len(depends) and row['id'] not in depends, 'DEPENDENCIES')
        require(row['due_at'] is None or integer(row['due_at']), 'DEADLINE')
        known[row['id']] = row
    require(involved == set(parties), 'UNUSED_PARTY')
    def visit(ref, path, done):
        require(ref in known and ref not in path, 'DEPENDENCY_GRAPH')
        if ref in done:
            return
        for other in known[ref]['depends_on']:
            visit(other,path|{ref},done)
        done.add(ref)
    done = set()
    for ref in known:
        visit(ref,set(),done)
    return known


def replay_event(bundle, record, state, previous, sequence, last_at, *, pending=False):
    shape(record, ('body','signer','signature'), 'EVENT_RECORD')
    body = record['body']
    shape(body, ('profile','trade','previous','sequence','leg','leg_ref','kind','actor','data','at'),
        'EVENT_FIELDS')
    require(body['profile'] == PROFILE and body['trade'] == bundle['id'] and
        body['previous'] == previous and type(body['sequence']) is int and
        body['sequence'] == sequence and integer(body['at']) and body['at'] >= last_at,
        'EVENT_CHAIN')
    require(type(body['leg']) is str and body['leg'] in state['rows'], 'EVENT_LEG')
    row = state['rows'][body['leg']]
    require(body['leg_ref'] == digest(LEG,{'trade':bundle['id'],'leg':row}), 'EVENT_LEG_REFERENCE')
    actor = record['signer']
    require(body['actor'] == actor and actor in bundle['body']['parties'], 'EVENT_ACTOR')
    if not pending:
        verify(actor,EVENT,body,record['signature'])
    kind, data, leg = body['kind'],body['data'],body['leg']
    current = state['legs'][leg]
    active = [ref for ref in current['disputes'] if not state['disputes'][ref]['resolved']]
    eid = digest(EVENT,record)
    if kind == 'CLAIM':
        shape(data, ('evidence',), 'CLAIM_FIELDS')
        require(hex_key(data['evidence']) and actor == row['debtor'] and
            current['acceptance'] is None, 'CLAIM_AUTHORITY')
        current['claim'] = eid
    elif kind == 'ACCEPT':
        shape(data, ('claim',), 'ACCEPT_FIELDS')
        require(actor == row['creditor'] and current['claim'] is not None and
            data['claim'] == current['claim'] and current['acceptance'] is None and not active,
            'ACCEPT_EXACT_CURRENT_CLAIM')
        current['acceptance'] = eid
    elif kind == 'DISPUTE':
        shape(data, ('reason','evidence'), 'DISPUTE_FIELDS')
        text(data['reason'],2048)
        require(hex_key(data['evidence']), 'DISPUTE_EVIDENCE')
        current['disputes'].append(eid)
        state['disputes'][eid] = {'leg':leg,'resolutions':{},'resolved':False}
    elif kind == 'RESOLVE':
        shape(data, ('dispute','resolution'), 'RESOLVE_FIELDS')
        text(data['resolution'],2048)
        require(type(data['dispute']) is str and data['dispute'] in state['disputes'], 'RESOLVE_DISPUTE')
        dispute = state['disputes'][data['dispute']]
        require(dispute['leg'] == leg and not dispute['resolved'] and
            actor not in dispute['resolutions'], 'RESOLVE_AUTHORITY')
        dispute['resolutions'][actor] = data['resolution']
        dispute['resolved'] = set(dispute['resolutions']) == set(bundle['body']['parties']) and \
            len(set(dispute['resolutions'].values())) == 1
    else:
        raise Refused('EVENT_KIND')
    return eid,body['at']


def checked_bundle(bundle, expected):
    require(hex_key(expected), 'EXPECTED_TRADE_REQUIRED')
    shape(bundle, ('body','id','assents','events'), 'BUNDLE_FIELDS')
    canonical(bundle)
    require(len(canonical({'bundle':bundle,'pending':None})) <= 262144, 'BUNDLE_SIZE')
    rows = checked_terms(bundle['body'])
    require(bundle['id'] == expected == digest(TERMS,bundle['body']), 'TERMS_CHANGED')
    assents = bundle['assents']
    require(type(assents) is list and len(assents) <= len(bundle['body']['parties']), 'ASSENTS')
    approved = set()
    for record in assents:
        shape(record, ('signer','signature'), 'ASSENT_FIELDS')
        actor = record['signer']
        require(type(actor) is str and actor in bundle['body']['parties'] and
            actor not in approved, 'ASSENT_PARTY')
        verify(actor,ASSENT,{'profile':PROFILE,'trade':expected},record['signature'])
        approved.add(actor)
    events = bundle['events']
    require(type(events) is list and len(events) <= 256 and
        (not events or len(approved) == len(bundle['body']['parties'])), 'EVENTS_REQUIRE_ASSENT')
    state = {'rows':rows,'approved':approved,'disputes':{},'legs':{
        ref:{'claim':None,'acceptance':None,'disputes':[]} for ref in rows}}
    previous,last_at = expected,0
    for index,record in enumerate(events,1):
        previous,last_at = replay_event(bundle,record,state,previous,index,last_at)
    state.update(head=previous,last_at=last_at)
    return state


def payload_value(value, mode):
    if type(value) is dict and 'ok' in value:
        shape(value, ('version','ok','result'), 'HTTP_ENVELOPE')
        require(value['version'] == 'urn:aap:hosted-api-http:0.1' and value['ok'] is True,
            'HTTP_ENVELOPE')
        value = value['result']
    if type(value) is dict and 'operation' in value:
        op = {'assent':'trade.signing_payload','event':'trade.event_payload',
            'wallet':'payment.instruction_payload'}[mode]
        if mode == 'wallet':
            shape(value, ('version','operation','result'), 'PAYLOAD_RECEIPT')
            require(value['version'] == 'urn:aap:hosted-payment-access:0.1', 'PAYLOAD_RECEIPT')
        else:
            shape(value, ('version','operation','result','signing_performed',
                'payment_dispatched','external_execution'), 'PAYLOAD_RECEIPT')
            require(value['version'] == 'urn:aap:hosted-api:0.1' and
                all(value[name] is False for name in ('signing_performed','payment_dispatched',
                    'external_execution')), 'PAYLOAD_RECEIPT')
        require(value['operation'] == op, 'PAYLOAD_OPERATION')
        value = value['result']
    return value


def wallet_payload(bundle,state,actor,payload,*,leg,kind,address):
    require(type(leg) is str and leg in state['rows'] and kind in ('sender','destination') and
        type(address) is str and re.fullmatch(r'0x[0-9a-fA-F]{40}',address) and
        int(address[2:],16) != 0, 'WALLET_INPUT')
    address = address.lower()
    row = state['rows'][leg]
    asset = row['resource']
    network = asset['network']
    require(network in TOKENS and canonical(asset) == canonical({'kind':'CRYPTO',
        'identifier':network+'/erc20:'+TOKENS[network],'unit':'USDC_MICRO','scale':6,
        'network':network,'metadata':None}), 'WALLET_ASSET')
    require(len(row['amount']) <= 78 and int(row['amount']) <= 2**256-1, 'WALLET_AMOUNT')
    role = 'creditor' if kind == 'destination' else 'debtor'
    require(actor == row[role], 'WALLET_ROLE')
    body = {'profile':USDC,'source_trade':bundle['id'],
        'source_leg':digest(USDC+'-source-leg',row),role:actor,
        'network':network,'token':TOKENS[network]}
    if kind == 'destination':
        body['recipient'] = address
        label = 'AAP-HOSTED-USDC-DESTINATION-0.1'
    else:
        body.update(purpose='PAYER_SENDER_WALLET_INSTRUCTION',sender=address)
        label = 'AAP-HOSTED-USDC-SENDER-0.1'
    expected = {'label':label,'body':body,'signer':actor,'execution_authorized':False}
    require(canonical(payload) == canonical(expected), 'WALLET_PAYLOAD_CHANGED')
    return label,body


MARKET = 'urn:aap:hosted-account-market:0.1'
CHECKOUT = 'urn:aap:marketplace-checkout:0.1'
FEE_POLICY = 'urn:aap:marketplace-fee-policy:0.1'
FEE_QUOTE = 'urn:aap:marketplace-fee-quote:0.1'
LAUNCH = 'urn:aap:marketplace-launch-economics:0.1'
FEE_TRIGGER = {'when':'EXACT_BUYER_ACCEPTED_DELIVERY_AND_OBSERVED_SETTLEMENT'}
FEE_ADDRESS = '0xa200dcd20612b73e211f8e39ee15d7627a871abc'


def same(left,right,code):
    require(canonical(left) == canonical(right),code)


def market_id(record):
    shape(record,('version','kind','author','title','data','frame','supersedes'),'MARKET_RECORD')
    require(record['version'] == 'covenant-marketplace/0.1' and
        record['kind'] in ('LISTING','ORDER') and hex_key(record['author']) and
        (record['supersedes'] is None or hex_key(record['supersedes'])), 'MARKET_RECORD')
    text(record['title'],256)
    return digest('COVENANT-MARKETPLACE-0.1',record)


def checked_source(packet):
    shape(packet,('version','selection','bindings','bundle','signing_payload','approval',
        'acting_for_owner','current_authority','inventory_reserved','payment_dispatched',
        'execution_authorized'),'SOURCE_PACKET')
    require(packet['version'] == CHECKOUT and packet['inventory_reserved'] is False and
        packet['payment_dispatched'] is False and packet['execution_authorized'] is False and
        packet['approval'] == 'EXACT_DIRECT_PARTY_ASSENTS_STILL_REQUIRED' and
        packet['acting_for_owner'] == 'USE_SEPARATE_OWNER_APPROVAL_NOT_OWNER_KEY_IN_AGENT_CONTEXT' and
        packet['current_authority'] == 'RECHECK_AT_ACTUAL_EXECUTION_GATE','SOURCE_PACKET')
    source = packet['bundle']
    checked_bundle(source,source['id'])
    # The source packet maps descriptive promises. Its own opaque execution
    # hashes would need a further attachment profile this client cannot check.
    require(all(row['mechanism']['adapter'] is None and
        row['mechanism']['request_hash'] is None and
        row['evidence_policy']['mode'] == 'RECIPIENT_ACCEPTANCE'
        for row in source['body']['legs']), 'SOURCE_EXECUTION_ATTACHMENTS_UNSUPPORTED')
    require(source['assents'] == [] and source['events'] == [],'SOURCE_PROPOSAL_ONLY')
    same(packet['signing_payload'],{'label':ASSENT,'body':{'profile':PROFILE,'trade':source['id']},
        'required_parties':source['body']['parties'],'direct_signatures_only':True},'SOURCE_SIGNING_PAYLOAD')
    selected = packet['selection']
    shape(selected,('body','id','assets_to_map','publication_freshness','seller_acceptance',
        'inventory_reserved','execution_authorized'),'SELECTION')
    sb = selected['body']
    shape(sb,('version','publication','listing','buyer','units','requirements','constraints','order','as_of'),
        'SELECTION_BODY')
    require(sb['version'] == CHECKOUT and selected['id'] == digest('AAP-MARKETPLACE-CHECKOUT-SELECTION-0.1',sb)
        and selected['publication_freshness'] == 'CALLER_SNAPSHOT_ONLY' and
        selected['seller_acceptance'] == 'REQUIRED' and selected['inventory_reserved'] is False and
        selected['execution_authorized'] is False and integer(sb['as_of']) and integer(sb['units'],True),
        'SELECTION_BINDING')
    listing,order = sb['listing'],sb['order']
    lid,oid = market_id(listing),market_id(order)
    require(listing['kind'] == 'LISTING' and order['kind'] == 'ORDER','SOURCE_KINDS')
    ld,od = listing['data'],order['data']
    shape(od,('market','listing','seller','buyer','units','give','receive','settlement','terms','context','archetype'),
        'ORDER_DATA')
    require(od['seller'] == listing['author'] and od['buyer'] == sb['buyer'] == order['author'] and
        od['buyer'] != od['seller'] and od['listing'] == lid and od['market'] == ld['market'] and
        type(od['units']) is int and od['units'] == sb['units'] and type(ld['quantity']) is int and 0 < sb['units'] <= ld['quantity'] and
        ld['mechanism'] in ('FIXED','NEGOTIABLE') and ld['active'] is True and
        order['title'] == listing['title'] and od['archetype'] == ld['archetype'],'ORDER_LISTING')
    require(type(sb['requirements']) is dict and bool(sb['requirements']) and
        len(canonical(sb['requirements'])) <= 2048,'SOURCE_REQUIREMENTS')
    same(od['terms'],{'listing_terms':ld['custom'],'explicit_additions':sb['requirements']},'ORDER_TERMS')
    same(od['settlement'],ld['settlement'],'ORDER_SETTLEMENT')
    require(od['context'] == digest(CHECKOUT+'-requirements',sb['requirements']),'ORDER_CONTEXT')
    assets = []
    for side,listing_side in (('give','want'),('receive','offer')):
        require(type(ld[listing_side]) is list and type(od[side]) is list,'ORDER_ASSETS')
        expected = []
        for item in ld[listing_side]:
            shape(item,('asset','amount'),'ASSET_AMOUNT')
            require(integer(item['amount'],True) and integer(item['amount']*sb['units'],True),'ASSET_AMOUNT')
            expected.append({'asset':item['asset'],'amount':item['amount']*sb['units']})
        same(od[side],expected,'ORDER_QUANTITIES')
        for index,item in enumerate(od[side]):
            shape(item['asset'],('namespace','identifier','unit','adapter','transfer_terms'),'ASSET_FIELDS')
            assets.append({'side':side,'index':index,'asset':item['asset'],
                'asset_id':digest('AAP-MARKETPLACE-CHECKOUT-ASSET-0.1',item['asset']),
                'amount':str(item['amount'])})
    same(selected['assets_to_map'],assets,'ASSET_MAP')
    publication = sb['publication']
    shape(publication,('body','approvals'),'PUBLICATION')
    pb = publication['body']
    shape(pb,('version','origin','id','kind','source','principals','sequence','previous',
        'visibility','fields','links','expires'),'PUBLICATION_BODY')
    require(pb['version'] == 'covenant-public-web/0.1' and pb['origin'] == ORIGIN and
        pb['kind'] == 'marketplace' and pb['source'] == {'type':'marketplace-listing','id':lid} and
        pb['principals'] == [od['seller']] and pb['visibility'] in ('INDEXED','UNLISTED') and
        integer(pb['sequence'],True) and (pb['previous'] is None or hex_key(pb['previous'])) and
        (pb['expires'] is None or integer(pb['expires'],True) and sb['as_of'] < pb['expires']),
        'PUBLICATION_SCOPE')
    require(type(pb['links']) is list and len(pb['links']) <= 32 and
        all(hex_key(ref) for ref in pb['links']) and pb['links'] == sorted(set(pb['links'])) and
        len(canonical(pb)) <= 64000, 'PUBLICATION_BOUNDS')
    require(pb['id'] == digest('COVENANT-PUBLIC-WEB-ITEM-0.1',{
        'origin':ORIGIN,'kind':'marketplace','source':pb['source']}),'PUBLICATION_ID')
    candidates = {'title':listing['title'],'record_kind':'LISTING',**ld}
    required_fields = {'title','record_kind','market','offer','want','mechanism','quantity',
        'settlement','archetype','custom','active'}
    require(type(pb['fields']) is dict and required_fields <= set(pb['fields']) <= set(candidates),
        'PUBLICATION_TERMS_MISSING')
    same(pb['fields'],{name:candidates[name] for name in pb['fields']},'PUBLICATION_PROJECTION')
    require(type(publication['approvals']) is list and len(publication['approvals']) == 1,
        'PUBLICATION_APPROVAL')
    consent = publication['approvals'][0]
    shape(consent,('signer','signature'),'PUBLICATION_APPROVAL')
    require(consent['signer'] == od['seller'],'PUBLICATION_SELLER')
    verify(od['seller'],'COVENANT-PUBLIC-WEB-0.1',pb,consent['signature'])
    bindings = packet['bindings']
    require(type(bindings) is list and len(bindings) == len(assets),'SOURCE_BINDINGS')
    terms_rows = []
    seen = set()
    for binding in bindings:
        shape(binding,('side','index','asset_id','id','resource','mechanism','evidence_policy',
            'depends_on','due_at'),'SOURCE_BINDING')
        position = (binding['side'],binding['index'])
        require(type(binding['side']) is str and type(binding['index']) is int and
            position not in seen,'SOURCE_BINDING')
        found = [item for item in assets if (item['side'],item['index']) == position]
        require(len(found) == 1,'SOURCE_BINDING')
        seen.add(position)
        item = found[0]
        require(binding['asset_id'] == item['asset_id'] and
            binding['resource']['unit'] == item['asset']['unit'],'SOURCE_RESOURCE_MAPPING')
        terms_rows.append({'id':binding['id'],
            'debtor':od['buyer'] if binding['side']=='give' else od['seller'],
            'creditor':od['seller'] if binding['side']=='give' else od['buyer'],
            'resource':binding['resource'],'amount':item['amount'],
            **{name:binding[name] for name in ('mechanism','evidence_policy','depends_on','due_at')}})
    same(source['body']['legs'],terms_rows,'SOURCE_LEGS')
    same(source['body']['parties'],[od['buyer'],od['seller']],'SOURCE_PARTIES')
    expected_context = {'version':CHECKOUT,'selection':selected['id'],'publication':pb['id'],
        'consent_hash':digest('COVENANT-PUBLIC-WEB-0.1',pb),'listing':lid,'order':oid,
        'order_terms':od,'requirements':sb['requirements'],'constraints':sb['constraints'],
        'resource_bindings':bindings}
    same(source['body']['context'],expected_context,'SOURCE_CONTEXT')
    constraints = sb['constraints']
    if constraints is not None:
        shape(constraints,('max_give','delivery_by','resources'),'CONSTRAINTS')
        require(set(constraints['max_give']) == {item['asset_id'] for item in assets if item['side']=='give'}
            and set(constraints['resources']) == {item['asset_id'] for item in assets},'CONSTRAINT_PINS')
        for binding in bindings:
            item = next(item for item in assets if item['side'] == binding['side'] and
                item['index'] == binding['index'])
            if item['side']=='give':
                cap = constraints['max_give'][item['asset_id']]
                require(integer(cap) and int(item['amount']) <= cap,'SOURCE_SPEND_CAP')
            require(constraints['resources'][binding['asset_id']] ==
                digest('AAP-MARKETPLACE-CHECKOUT-RESOURCE-0.1',binding['resource']),'RESOURCE_PIN')
            if binding['side']=='receive' and constraints['delivery_by'] is not None:
                require(integer(constraints['delivery_by']) and type(binding['due_at']) is int and
                    sb['as_of'] < binding['due_at'] <= constraints['delivery_by'],'SOURCE_DEADLINE')
    return source,order


def checked_economics(economic,order,plan):
    if economic is None:
        return None,0
    shape(economic,('quote','resource','allocations','disclosure'),'LAUNCH_ECONOMICS_PROFILE_REQUIRED')
    allocations = economic['allocations']
    require(type(allocations) is list and 1 <= len(allocations) <= 16,'FEE_ALLOCATIONS')
    seen = set()
    for allocation in allocations:
        shape(allocation,('account','bps','purpose'),'FEE_ALLOCATION')
        require(hex_key(allocation['account']) and allocation['account'] not in seen and
            integer(allocation['bps'],True) and allocation['bps'] <= 10000,'FEE_ALLOCATION')
        text(allocation['purpose'])
        seen.add(allocation['account'])
    require(sum(row['bps'] for row in allocations) == 10000,'FEE_ALLOCATION_TOTAL')
    disclosure = economic['disclosure']
    shape(disclosure,('body','signer','signature'),'FEE_DISCLOSURE')
    db = disclosure['body']
    shape(db,('version','policy','issued_at','valid_until','fee_bps','fee_opt_in','maximum_fee',
        'economic_snapshot','mode','effective_bps','fee_required','reason'),'FEE_DISCLOSURE_BODY')
    require(db['version'] == LAUNCH and hex_key(db['policy']) and integer(db['issued_at']) and
        integer(db['valid_until'],True) and db['valid_until'] > db['issued_at'] and
        db['fee_bps'] == 50 and type(db['fee_bps']) is int and type(db['fee_opt_in']) is bool and
        db['fee_opt_in'] is plan['fee_opt_in'] and type(db['maximum_fee']) is int and
        db['maximum_fee'] == plan['maximum_fee'] and type(db['fee_required']) is bool,
        'FEE_DISCLOSURE_CHANGED')
    core = {name:economic[name] for name in ('quote','resource','allocations')}
    require(db['economic_snapshot'] == digest(LAUNCH+'-economic',core),'FEE_SNAPSHOT')
    verify(disclosure['signer'],'AAP-MARKETPLACE-LAUNCH-QUOTE-0.1',db,disclosure['signature'])
    quote = economic['quote']
    if quote is None:
        require(economic['resource'] is None and db['mode'] == 'SEPARATE_FEE_TERMS_REQUIRED' and
            db['effective_bps'] is None and db['reason'] == 'NO_VALUATION_OR_FX_FOR_UNMAPPED_OR_MULTIPLE_RESOURCES',
            'UNMAPPED_FEE')
        return None,0
    shape(quote,('body','id','binding','collection_enabled','execution_authorized',
        'fee_provider_assent_verified','assent','settlement'),'FEE_QUOTE')
    qb = quote['body']
    shape(qb,('version','order','policy','policy_id','maximum_fee','principal_in_fee_resource',
        'provider_approval','fee','payer','beneficiary','fee_resource','rail','destination','burden',
        'trigger','refund','buyer_gives_if_adopted','seller_receives_if_adopted',
        'net_resource_changes_if_all_terms_execute','conversion'),'FEE_QUOTE_BODY')
    require(qb['version'] == FEE_QUOTE and quote['id'] == digest(FEE_QUOTE,qb) and
        qb['order'] == market_id(order) and type(qb['maximum_fee']) is int and
        qb['maximum_fee'] == plan['maximum_fee'] and
        all(quote[name] is False for name in ('binding','collection_enabled','execution_authorized')) and
        quote['fee_provider_assent_verified'] is True and
        quote['assent'] == 'EXACT_FEE_TERMS_STILL_REQUIRE_FRESH_PARTY_APPROVALS' and
        quote['settlement'] == 'NO_COLLECTION_OR_CROSS_RAIL_ATOMICITY_ESTABLISHED','FEE_QUOTE_BINDING')
    policy = qb['policy']
    shape(policy,('body','id','binding','collection_enabled','execution_authorized',
        'destination_control_verified','trigger_semantics'),'FEE_POLICY')
    pb = policy['body']
    shape(pb,('version','market','fee_resource','rail','destination','pricing','burden','trigger','refund'),
        'FEE_POLICY_BODY')
    require(pb['version'] == FEE_POLICY and policy['id'] == digest(FEE_POLICY,pb) == qb['policy_id'] and
        pb['market'] == order['data']['market'] and
        all(policy[name] is False for name in ('binding','collection_enabled','execution_authorized',
            'destination_control_verified')) and policy['trigger_semantics'] ==
        'EXACT_TERMS_ONLY_ADOPTED_OBSERVER_AND_RAIL_STILL_REQUIRED','FEE_POLICY_BINDING')
    for name in ('fee_resource','rail','destination','burden','trigger','refund'):
        same(qb[name],pb[name],'FEE_POLICY_CHANGED')
    require(pb['burden'] == 'BUYER_ADDITIONAL' and pb['trigger'] == FEE_TRIGGER and
        qb['payer'] == order['data']['buyer'] and qb['beneficiary'] == disclosure['signer'],
        'FEE_PARTIES_AND_TRIGGER')
    pricing = pb['pricing']
    shape(pricing,('version','unit','fixed','bps','minimum','maximum','beneficiary','token'),'FEE_PRICING')
    require(pricing['version'] == 'covenant-network-fee/0.1' and
        pricing['beneficiary'] == qb['beneficiary'] and pricing['unit'] == qb['fee_resource']['unit'] and
        all(integer(pricing[name]) for name in ('fixed','bps','minimum','maximum')) and
        pricing['fixed'] == pricing['minimum'] == 0 and pricing['maximum'] == MAX_SAFE_INTEGER and
        pricing['bps'] in (0,50),'FEE_PRICING_PROFILE')
    same(pricing['token'],{'version':'covenant-token-utility/0.1',
        'resource':'NO_LAUNCH_TOKEN_DISCOUNT_ADOPTED','discount_bps':0,'credit_prices':{}},'FEE_TOKEN_PROFILE')
    expected_mode = 'MANDATORY' if db['fee_required'] else 'OPTIONAL_OPT_IN' if db['fee_opt_in'] else 'OPTIONAL_WAIVED'
    require(db['mode'] == expected_mode and type(db['effective_bps']) is int and
        db['effective_bps'] == pricing['bps'] == (50 if db['fee_required'] or db['fee_opt_in'] else 0)
        and db['reason'] == 'EXACT_SINGLE_PRINCIPAL_RESOURCE_NO_CONVERSION','FEE_TIMING_MODE')
    matched = [row for row in order['data']['give'] if canonical(row['asset']) == canonical(qb['fee_resource'])]
    require(len(order['data']['give']) == len(matched) == 1,'FEE_PRINCIPAL_RESOURCE')
    principal = sum(row['amount'] for row in matched)
    charged = (principal*pricing['bps']+9999)//10000
    require(integer(principal) and type(qb['principal_in_fee_resource']) is int and
        qb['principal_in_fee_resource'] == principal and charged <= plan['maximum_fee'],'FEE_CAP')
    expected_fee = {'policy':digest('COVENANT-NETWORK-FEE-0.1',pricing),'unit':pricing['unit'],
        'amount':charged,'undiscounted':charged,'token_discount_bps':0,'beneficiary':qb['beneficiary'],
        'funding_or_profit':'NOT_ESTABLISHED','holder_yield_or_price_support':'NONE','binding':False,
        'founder_on_principal':0,'founder_on_fee':0,'founder_route':'ECONOMICS_BENEFICIARY_ROW','rail':'REGISTRY'}
    same(qb['fee'],expected_fee,'FEE_AMOUNT')
    approval = qb['provider_approval']
    shape(approval,('beneficiary','signature'),'FEE_PROVIDER_APPROVAL')
    require(approval['beneficiary'] == qb['beneficiary'],'FEE_PROVIDER')
    verify(qb['beneficiary'],'AAP-MARKETPLACE-FEE-POLICY-0.1',
        {'policy':policy['id'],'beneficiary':qb['beneficiary']},approval['signature'])
    require(qb['conversion'] == 'NONE_EXACT_RESOURCE_IDENTITY_ONLY' and
        economic['resource']['unit'] == qb['fee_resource']['unit'],'FEE_RESOURCE_MAPPING')
    gives = [dict(row) for row in order['data']['give']]
    gives[0] = {**gives[0],'amount':gives[0]['amount']+charged}
    same(qb['buyer_gives_if_adopted'],gives,'FEE_TOTAL')
    same(qb['seller_receives_if_adopted'],order['data']['give'],'SELLER_TOTAL')
    flows,assets = {},{}
    def move(debtor,creditor,asset,amount):
        pin = digest(FEE_POLICY+'-asset',asset)
        assets[pin] = asset
        for who,factor in ((debtor,-1),(creditor,1)):
            flows[(who,pin)] = flows.get((who,pin),0)+factor*amount
    od = order['data']
    for item in od['give']:
        move(od['buyer'],od['seller'],item['asset'],item['amount'])
    for item in od['receive']:
        move(od['seller'],od['buyer'],item['asset'],item['amount'])
    move(qb['payer'],qb['beneficiary'],qb['fee_resource'],charged)
    net = [{'party':who,'asset_id':pin,'asset':assets[pin],'net':amount}
        for (who,pin),amount in sorted(flows.items()) if amount]
    same(qb['net_resource_changes_if_all_terms_execute'],net,'FEE_NET_FLOWS')
    return qb,charged


def checked_usdc_request(request,row,plan,source,economic,fee):
    shape(request,('profile','plan','source_trade','source_row','purpose','sender','recipient',
        'token','network','amount','authorization_ttl_seconds','payment_deadline','nonce','destination'),
        'PAYMENT_REQUEST_PROFILE')
    require(request['profile'] == USDC and request['plan'] == plan and
        request['source_trade'] == source['id'] and canonical(request['source_row']) == canonical(row) and
        request['network'] in TOKENS and request['token'] == TOKENS[request['network']] and
        request['amount'] == row['amount'] and type(request['authorization_ttl_seconds']) is int and
        request['authorization_ttl_seconds'] == 3600 and canonical(request['payment_deadline']) == canonical(row['due_at']),
        'PAYMENT_REQUEST_BINDING')
    network = request['network']
    same(row['resource'],{'kind':'CRYPTO','identifier':network+'/erc20:'+TOKENS[network],
        'unit':'USDC_MICRO','scale':6,'network':network,'metadata':None},'PAYMENT_ASSET')
    for name in ('sender','recipient'):
        require(type(request[name]) is str and re.fullmatch(r'0x[0-9a-f]{40}',request[name]) and
            int(request[name][2:],16) != 0,'PAYMENT_ADDRESS')
    require(request['sender'] != request['recipient'],'PAYMENT_COUNTERPARTIES')
    if row['id'] == 'marketplace-fee':
        require(fee is not None and request['purpose'] == 'fee' and request['recipient'] == FEE_ADDRESS and
            row['creditor'] == fee['beneficiary'],'FEE_RECIPIENT')
        same(request['destination'],{'authority':'OWNER_PUBLISHED_FEE_WALLET',
            'recipient':FEE_ADDRESS},'FEE_DESTINATION')
        require(fee['destination']['account'].lower() == FEE_ADDRESS and
            fee['destination']['network'] == network,'FEE_POLICY_DESTINATION')
    else:
        require(request['purpose'] == 'principal','PAYMENT_PURPOSE')
        proof = request['destination']
        shape(proof,('body','signature'),'SELLER_DESTINATION_PROOF')
        body = {'profile':USDC,'source_trade':source['id'],'source_leg':digest(USDC+'-source-leg',row),
            'creditor':row['creditor'],'network':network,'token':TOKENS[network],
            'recipient':request['recipient']}
        same(proof['body'],body,'SELLER_DESTINATION_BINDING')
        verify(row['creditor'],'AAP-HOSTED-USDC-DESTINATION-0.1',body,proof['signature'])
    nonce = digest(USDC+'-nonce',{'plan':plan,'leg':row['id'],'source_trade':source['id'],
        'purpose':request['purpose'],'sender':request['sender'],'destination':request['destination']})
    require(request['nonce'] == '0x'+nonce,'PAYMENT_NONCE')


def checked_package(package,bundle):
    shape(package,('version','plan','plan_body','source_packet','economics','requests','bundle',
        'signing_payload','requires_fresh_all_party_assent','settlement','collection_activated',
        'execution_authorized'),'MARKET_PACKAGE')
    require(package['version'] == MARKET and package['requires_fresh_all_party_assent'] is True and
        package['settlement'] == 'OWNER_INSTALLED_ADAPTER_AND_EXACT_OWNER_SIGNATURES_REQUIRED' and
        package['collection_activated'] is False and package['execution_authorized'] is False,
        'MARKET_PACKAGE_PROFILE')
    original = package['bundle']
    checked_bundle(original,original['id'])
    same(original['body'],bundle['body'],'MARKET_TERMS_CHANGED')
    require(original['id'] == bundle['id'] and original['events'] == [],'MARKET_BUNDLE_CHANGED')
    for record in original['assents']:
        require(any(canonical(record) == canonical(held) for held in bundle['assents']),
            'MARKET_PROVIDER_ASSENT_MISSING')
    plan = package['plan_body']
    shape(plan,('version','source_trade','source_packet','nonce','maximum_fee','fee_opt_in',
        'economics','routes','fee_leg','fee_settlement_guards'),'MARKET_PLAN')
    require(plan['version'] == MARKET and hex_key(plan['nonce']) and integer(plan['maximum_fee']) and
        type(plan['fee_opt_in']) is bool and package['plan'] == digest(MARKET+'-plan',plan),
        'MARKET_PLAN_BINDING')
    same(package['economics'],plan['economics'],'MARKET_ECONOMICS_CHANGED')
    source,order = checked_source(package['source_packet'])
    require(plan['source_trade'] == source['id'] and plan['source_packet'] ==
        digest(MARKET+'-source-packet',package['source_packet']),'MARKET_SOURCE_BINDING')
    fee,amount = checked_economics(package['economics'],order,plan)
    rows = [dict(row) for row in source['body']['legs']]
    fee_leg = 'marketplace-fee' if amount else None
    guards = [binding['id'] for binding in package['source_packet']['bindings'] if binding['side']=='give'] if amount else []
    require(plan['fee_leg'] == fee_leg,'FEE_LEG')
    same(plan['fee_settlement_guards'],guards,'FEE_GUARDS')
    if amount:
        rows.append({'id':fee_leg,'debtor':fee['payer'],'creditor':fee['beneficiary'],
            'resource':package['economics']['resource'],'amount':str(amount),
            'mechanism':{'identifier':'MANUAL_FEE_NOT_CONNECTED','adapter':None,'request_hash':None},
            'evidence_policy':{'mode':'RECIPIENT_ACCEPTANCE','verifier':None,
                'finality':'RECIPIENT_SIGNED_ACCEPTANCE','minimum_confirmations':0},
            'depends_on':[binding['id'] for binding in package['source_packet']['bindings']
                if binding['side']=='receive'],'due_at':None})
    routes,requests = plan['routes'],package['requests']
    require(type(routes) is dict and type(requests) is dict and set(routes) == set(requests) and
        set(routes) <= {row['id'] for row in rows},'PAYMENT_ROUTE_SET')
    final_rows = []
    for row in rows:
        result = dict(row)
        if row['id'] in routes:
            route,request = routes[row['id']],requests[row['id']]
            shape(route,('adapter','verifier','resource','creditor','implementation','finality',
                'minimum_confirmations'),'PAYMENT_ROUTE')
            require(all(hex_key(route[name]) for name in ('adapter','verifier','implementation')) and
                route['creditor'] == row['creditor'] and route['finality'] ==
                'OWNER_CONFIGURED_RPC_FINALIZED_CANONICAL_BLOCK' and
                type(route['minimum_confirmations']) is int and route['minimum_confirmations'] == 1,
                'PAYMENT_ROUTE_PROFILE')
            same(route['resource'],row['resource'],'PAYMENT_ROUTE_RESOURCE')
            checked_usdc_request(request,row,package['plan'],source,package['economics'],fee)
            result['mechanism'] = {'identifier':MARKET,'adapter':route['adapter'],
                'request_hash':hashlib.sha256(canonical(request)).hexdigest()}
            result['evidence_policy'] = {'mode':'OWNER_VERIFIER','verifier':route['verifier'],
                'finality':route['finality'],'minimum_confirmations':route['minimum_confirmations']}
        final_rows.append(result)
    expected_context = {'version':MARKET,'plan':package['plan'],'source_trade':source['id'],
        'source_packet':plan['source_packet'],'fee_quote':None if fee is None else package['economics']['quote']['id'],
        'fee_settlement_guards':guards,'atomicity':'SEPARATE_LEG_EFFECTS_NOT_CROSS_RAIL_ATOMIC',
        'fee_provider_scope':'ONLY_OWN_POSTED_FEE_AND_REFUND_TERMS; SOURCE_DUTIES_BELONG_TO_SOURCE_PARTIES',
        'all_attachments_required_before_assent':True}
    expected_body = {'profile':PROFILE,'parties':sorted({person for row in final_rows for person in
        (row['debtor'],row['creditor'])}),'legs':final_rows,'nonce':plan['nonce'],
        'context':expected_context,'previous':source['id']}
    same(bundle['body'],expected_body,'FINAL_MARKET_TERMS')
    same(package['signing_payload'],{'label':ASSENT,'body':{'profile':PROFILE,'trade':bundle['id']},
        'required_parties':bundle['body']['parties'],'direct_signatures_only':True},'MARKET_SIGNING_PAYLOAD')
    return {'source':source['id'],'fee_amount':amount,'fee_payer':None if fee is None else fee['payer'],
        'fee_beneficiary':None if fee is None else fee['beneficiary'],
        'launch_policy_currentness':'NOT_CHECKED_SIGNED_DISCLOSURE_ONLY',
        'provider_implementation':'DECLARED_HASH_NOT_EXECUTED_OR_INSTALLED_BY_THIS_COMMAND'}

def checked_action(mode,bundle,expected,actor,payload,*,leg=None,kind=None,address=None,package=None):
    require(mode in ('assent','event','wallet'), 'ACTION_MODE')
    state = checked_bundle(bundle,expected)
    # Market plans require their complete source, economics and request attachments.
    # The narrow client cannot infer those from an opaque hash in native terms.
    context = bundle['body']['context']
    # Caller-controlled context names/flags cannot select a weaker review.
    # Every opaque execution request or owner-verifier policy needs a fully
    # supported package, even if disguised as an ordinary/manual agreement.
    opaque_execution = any(row['mechanism']['adapter'] is not None or
        row['mechanism']['request_hash'] is not None or
        row['evidence_policy']['mode'] == 'OWNER_VERIFIER' for row in state['rows'].values())
    is_market = opaque_execution or (type(context) is dict and
        (context.get('all_attachments_required_before_assent') is True or context.get('version') == MARKET))
    require((package is not None) == is_market, 'COMPLETE_MARKET_PACKAGE_REQUIRED')
    if is_market:
        checked_package(package,bundle)
    require(actor in bundle['body']['parties'], 'OWNER_NOT_PARTY')
    payload = payload_value(payload,mode)
    if mode == 'assent':
        require(actor not in state['approved'], 'OWNER_ALREADY_APPROVED')
        expected_payload = {'label':ASSENT,'body':{'profile':PROFILE,'trade':expected},
            'required_parties':bundle['body']['parties'],'direct_signatures_only':True}
        require(canonical(payload) == canonical(expected_payload), 'ASSENT_PAYLOAD_CHANGED')
        label,body = ASSENT,expected_payload['body']
    elif mode == 'event':
        require(len(state['approved']) == len(bundle['body']['parties']) and
            len(bundle['events']) < 256, 'EVENT_REQUIRES_ALL_APPROVALS')
        shape(payload, ('label','body','signer'), 'EVENT_PAYLOAD_FIELDS')
        require(payload['label'] == EVENT and payload['signer'] == actor, 'EVENT_OWNER')
        pending = {'body':payload['body'],'signer':actor,'signature':''}
        require(len(canonical({'bundle':bundle,'pending':pending})) <= 262144, 'BUNDLE_SIZE')
        replay_event(bundle,pending,state,
            state['head'],len(bundle['events'])+1,state['last_at'],pending=True)
        label,body = EVENT,payload['body']
    else:
        label,body = wallet_payload(bundle,state,actor,payload,leg=leg,kind=kind,address=address)
    return label,body,payload


def display_review(stdout,mode,bundle,actor,label,body):
    actions = {'assent':'APPROVE THESE EXACT AGREEMENT TERMS',
        'event':'APPROVE ONE AGREEMENT UPDATE','wallet':'APPROVE ONE RECEIVING OR PAYER ADDRESS'}
    stdout.write(actions[mode]+'\nAgreement: '+bundle['id']+'\nYou: '+actor+'\n')
    stdout.write('Who owes what:\n')
    for row in bundle['body']['legs']:
        asset = row['resource']
        amount = row['amount']
        scale = asset['scale']
        if scale:
            padded = amount.zfill(scale+1)
            displayed = padded[:-scale]+'.'+padded[-scale:]
        else:
            displayed = amount
        stdout.write(row['id']+': '+row['debtor']+' owes '+row['creditor']+' '+
            displayed+' '+asset['identifier']+' ('+amount+' '+asset['unit']+
            '; network '+asset['network']+').\n')
        stdout.write('After: '+(', '.join(row['depends_on']) or 'no earlier steps')+
            '. Deadline (Unix seconds): '+str(row['due_at'])+'.\n')
    stdout.write('Complete terms and supplied signed history:\n'+
        json.dumps(bundle,sort_keys=True,indent=2,ensure_ascii=True)+'\n')
    stdout.write('Exact action to sign:\n'+json.dumps({'label':label,'body':body},
        sort_keys=True,indent=2,ensure_ascii=True)+'\n')
    stdout.write('These are direct party keys. This command does not check delegated authority, '+
        'live account status, outside evidence, wallet control or whether a supplied history is current.\n')
    if mode == 'event':
        stdout.write('A claim or acceptance records your statement. A dispute resolution here '+
            'needs the same resolution from every party; it does not appoint a court or arbitrator.\n')
    if mode == 'wallet':
        stdout.write('This approves an address instruction only. It does not approve the agreement, '+
            'authorize spending, sign a wallet transaction or prove control of the address.\n')
    stdout.write('No network call, publication or payment is made.\n')


def run(access_path,bundle_path,payload_path,output_path,*,mode,expected_trade,
        leg=None,kind=None,address=None,package_path=None,stdin,stdout):
    require(os.name == 'posix' and hasattr(os,'O_NOFOLLOW') and stdin.isatty() and
        stdout.isatty(), 'OWNER_TERMINAL_REQUIRED')
    require(not os.path.lexists(Path(output_path).expanduser().absolute()), 'OUTPUT_EXISTS')
    access,access_pin = read_document(access_path,32768)
    shape(access,ACCESS_FIELDS,'TRIAL_ACCESS_FILE')
    require(access['version'] == ACCESS_VERSION and access['origin'] == ORIGIN and
        all(hex_key(access[name]) for name in ('actor','private_seed','token','client_nonce')),
        'TRIAL_ACCESS_FILE')
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(access['private_seed']))
    actor = key.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw).hex()
    require(actor == access['actor'], 'ACCESS_ACTOR_MISMATCH')
    bundle,bundle_pin = read_document(bundle_path,262144)
    payload,payload_pin = read_document(payload_path,262144)
    package,package_pin = read_document(package_path,1048576) if package_path is not None else (None,None)
    label,body,action = checked_action(mode,bundle,expected_trade,actor,payload,
        leg=leg,kind=kind,address=address,package=package)
    reviewed = canonical({'bundle':bundle,'action':action,'package':package}).decode('ascii').lower()
    require(all(secret.lower() not in reviewed for secret in
        (access['private_seed'],access['token'])), 'SECRET_IN_REVIEW')
    display_review(stdout,mode,bundle,actor,label,body)
    if package is not None:
        summary = checked_package(package,bundle)
        stdout.write('Market totals and fee: '+json.dumps(summary,sort_keys=True)+'\n')
        stdout.write('Complete source, fee terms and payment request attachments:\n'+
            json.dumps(package,sort_keys=True,indent=2,ensure_ascii=True)+'\n')
        stdout.write('The named provider observes payments. Its code, live setup and launch-policy currentness are not checked here.\n')
        stdout.write('Disputes: every named participant must sign a resolution under this profile. If the fee recipient is a third participant, its signature is also required for customer disputes.\n')
    approval_hash = digest('AAP-OWNER-LOCAL-REVIEW-0.1',
        {'mode':mode,'bundle':bundle,'action':action,'actor':actor,'package':package})
    phrase = 'APPROVE '+approval_hash[:12]
    stdout.write('To approve, type exactly: '+phrase+'\n> ')
    stdout.flush()
    require(stdin.readline(256).rstrip('\r\n') == phrase, 'APPROVAL_NOT_GIVEN')
    for path,pin in ((access_path,access_pin),(bundle_path,bundle_pin),(payload_path,payload_pin)):
        unchanged(path,pin)
    if package_path is not None:
        unchanged(package_path,package_pin)
    approval = {'signer':actor,'signature':key.sign(message(label,body)).hex()}
    if mode == 'event':
        approval['body'] = body
    new_output(output_path,approval)
    stdout.write('Approval saved. Return only the approval file with the unchanged agreement '+
        'and action to your agent. Keep your private access file. Nothing was sent or paid.\n')
    stdout.flush()


class Parser(argparse.ArgumentParser):
    def error(self,unused):
        raise Refused('ARGUMENTS')


def main():
    parser = Parser(description=__doc__)
    parser.add_argument('--access',required=True,type=Path)
    parser.add_argument('--bundle',required=True,type=Path,help='Complete bare native TradeBundle JSON')
    parser.add_argument('--payload',required=True,type=Path,help='Exact decoded signing payload or API receipt')
    parser.add_argument('--package',type=Path,help='Complete decoded market.prepare result for market terms')
    parser.add_argument('--expected-trade',required=True,help='Trade ID retained separately from the files')
    parser.add_argument('--mode',required=True,choices=('assent','event','wallet'))
    parser.add_argument('--leg',help='Wallet instruction leg ID')
    parser.add_argument('--kind',choices=('sender','destination'))
    parser.add_argument('--address',help='Expected external wallet address; wallet mode only')
    parser.add_argument('--output',required=True,type=Path,help='New owner-private approval file')
    args = parser.parse_args()
    require((args.mode == 'wallet') == all(value is not None for value in
        (args.leg,args.kind,args.address)) and (args.mode == 'wallet' or all(value is None
        for value in (args.leg,args.kind,args.address))), 'WALLET_ARGUMENTS')
    run(args.access,args.bundle,args.payload,args.output,mode=args.mode,
        expected_trade=args.expected_trade,leg=args.leg,kind=args.kind,address=args.address,
        package_path=args.package,stdin=sys.stdin,stdout=sys.stdout)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is Refused else 'LOCAL_CHECK_FAILED'
        print('Approval not created: '+code+'. Keep the original files. Nothing was sent or paid.',file=sys.stderr)
        raise SystemExit(1)
