#!/usr/bin/env python3
"""Approve one exact hosted advert offline. Python 3.10+, macOS/Linux, cryptography.

Independent implementation of the public-web/0.1 publication wire format.
No Covenant core imports, network access, publication, payment or general signer.
The terminal review is a local consent step, not hardware or process isolation.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

ORIGIN = 'https://jupie202020.pythonanywhere.com'
LABEL = 'COVENANT-PUBLIC-WEB-0.1'
ITEM_LABEL = 'COVENANT-PUBLIC-WEB-ITEM-0.1'
PROFILE = 'covenant-public-web/0.1'
ACCESS_VERSION = 'aap-private-trial-client/0.1'
HEX = re.compile(r'[0-9a-f]{64}\Z')
MAX_SAFE_INTEGER = 2**53 - 1
BODY_FIELDS = frozenset(('version', 'origin', 'id', 'kind', 'source', 'principals',
    'sequence', 'previous', 'visibility', 'fields', 'links', 'expires'))
PREVIEW_FIELDS = frozenset(('id', 'body', 'required_signers', 'signing_label', 'url',
    'available_fields', 'preview', 'execution_authorized', 'published'))
ACCESS_FIELDS = frozenset(('version', 'origin', 'actor', 'private_seed', 'token',
    'client_nonce', 'challenge', 'signature', 'grant'))


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


def preview_value(value):
    """Accept the prepared object, native receipt, or exact hosted HTTP envelope."""
    if type(value) is dict and 'ok' in value:
        shape(value, ('version', 'ok', 'result'), 'HTTP_ENVELOPE')
        require(value['version'] == 'urn:aap:hosted-api-http:0.1' and value['ok'] is True,
            'HTTP_ENVELOPE')
        value = value['result']
    if type(value) is dict and 'operation' in value:
        shape(value, ('version', 'operation', 'result', 'signing_performed',
            'payment_dispatched', 'external_execution'), 'PREPARE_RECEIPT')
        require(value['version'] == 'urn:aap:hosted-api:0.1' and
            value['operation'] == 'listing.prepare' and value['signing_performed'] is False and
            value['payment_dispatched'] is False and value['external_execution'] is False,
            'PREPARE_RECEIPT')
        value = value['result']
    shape(value, PREVIEW_FIELDS, 'PREVIEW_FIELDS')
    return value


def checked_listing(value, actor, now):
    prepared = preview_value(value)
    require(prepared['signing_label'] == LABEL and prepared['published'] is False and
        prepared['execution_authorized'] is False, 'PUBLICATION_ONLY')
    body = prepared['body']
    shape(body, BODY_FIELDS, 'PUBLICATION_BODY')
    require(body['version'] == PROFILE and body['kind'] == 'marketplace' and
        body['origin'] == ORIGIN, 'PUBLICATION_TARGET')
    shape(body['source'], ('type', 'id'), 'SOURCE_REFERENCE')
    require(body['source']['type'] == 'marketplace-listing' and hex_key(body['source']['id']),
        'LISTING_SOURCE_ONLY')
    item = hashlib.sha256(ITEM_LABEL.encode('ascii') + b'\0' + canonical({
        'origin': ORIGIN, 'kind': 'marketplace', 'source': body['source']})).hexdigest()
    require(body['id'] == item and prepared['id'] == item and
        prepared['url'] == ORIGIN + '/marketplace/' + item, 'ITEM_REFERENCE')
    # A listing has exactly its author as principal; orders and escrow are refused.
    require(canonical(body['principals']) == canonical([actor]) and
        canonical(prepared['required_signers']) == canonical([actor]), 'SIGNER_MISMATCH')
    require(integer(body['sequence'], True) and
        (body['previous'] is None or hex_key(body['previous'])), 'REVISION')
    require(body['visibility'] in ('PRIVATE', 'UNLISTED', 'INDEXED'), 'VISIBILITY')
    require(body['expires'] is None or integer(body['expires'], True) and
        body['expires'] > now, 'PUBLICATION_EXPIRED')
    fields = body['fields']
    require(type(fields) is dict and 1 <= len(fields) <= 32 and 'title' in fields and
        type(fields['title']) is str and 0 < len(fields['title']) <= 256 and
        all(type(name) is str and 0 < len(name) <= 64 for name in fields), 'PUBLIC_FIELDS')
    if 'record_kind' in fields:
        require(fields['record_kind'] == 'LISTING', 'LISTING_SOURCE_ONLY')
    require(type(body['links']) is list and len(body['links']) <= 32 and
        all(hex_key(item) for item in body['links']) and
        body['links'] == sorted(set(body['links'])), 'LINKS')
    available = prepared['available_fields']
    require(type(available) is list and 1 <= len(available) <= 64 and
        all(type(name) is str and 0 < len(name) <= 64 for name in available) and
        available == sorted(set(available)) and set(fields) <= set(available), 'AVAILABLE_FIELDS')
    review = prepared['preview']
    shape(review, ('public_fields', 'public_metadata', 'indexable', 'private_source_exported',
        'boundary'), 'PREVIEW_REVIEW')
    require(canonical(review['public_fields']) == canonical(fields) and
        review['indexable'] is (body['visibility'] == 'INDEXED') and
        review['private_source_exported'] is False and type(review['boundary']) is str and
        0 < len(review['boundary']) <= 4000 and canonical(review['public_metadata']) ==
        canonical(['origin', 'source hash/type', 'signing identities', 'revision', 'visibility',
                   'expiry', 'explicit links', 'consent signatures']), 'PREVIEW_REVIEW')
    wire = canonical(body)
    require(len(wire) <= 64000, 'PUBLICATION_SIZE')
    return body, LABEL.encode('ascii') + b'\0' + wire


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


def run(access_path, preview_path, output_path, *, stdin, stdout, now=None):
    require(os.name == 'posix' and hasattr(os, 'O_NOFOLLOW') and
        stdin.isatty() and stdout.isatty(), 'OWNER_TERMINAL_REQUIRED')
    # Refuse an existing destination before reading a private key or showing terms.
    parent, name = open_parent(output_path)
    try:
        require(not os.path.lexists(Path(output_path).expanduser().absolute()), 'OUTPUT_EXISTS')
    finally:
        os.close(parent)
    access, access_pin = read_document(access_path, 32768)
    shape(access, ACCESS_FIELDS, 'TRIAL_ACCESS_FILE')
    require(access['version'] == ACCESS_VERSION and access['origin'] == ORIGIN and
        all(hex_key(access[name]) for name in ('actor', 'private_seed', 'token', 'client_nonce')),
        'TRIAL_ACCESS_FILE')
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(access['private_seed']))
    actor = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
    require(actor == access['actor'], 'ACCESS_ACTOR_MISMATCH')
    prepared, preview_pin = read_document(preview_path, 262144)
    body, message = checked_listing(prepared, actor, int(time.time()) if now is None else now)
    # Never display/sign a publication containing this access file's secrets.
    public_text = canonical(body).decode('ascii').lower()
    require(all(secret.lower() not in public_text for secret in
        (access['private_seed'], access['token'])), 'SECRET_IN_PUBLICATION')
    body_hash = hashlib.sha256(message).hexdigest()
    stdout.write('APPROVE ONE HOSTED SERVICE ADVERT\n')
    stdout.write('All publication fields and metadata you are approving:\n')
    stdout.write(json.dumps(body, sort_keys=True, indent=2, ensure_ascii=True) + '\n')
    warnings = {'PRIVATE': 'PRIVATE keeps this publisher record out of public pages; it is not encrypted storage.',
        'UNLISTED': 'UNLISTED is readable by anyone with the link; it is not confidential.',
        'INDEXED': 'INDEXED makes these fields and metadata public and searchable.'}
    stdout.write(warnings[body['visibility']] + '\n')
    stdout.write('Previously shared copies cannot be recalled. This signs only the displayed advert.\n')
    stdout.write('The source hash is a reference; the private source, identity and current publication state are not independently verified here.\n')
    stdout.write('No contract, payment, delegation or publication is executed.\n')
    confirmation = 'APPROVE ' + body_hash[:12]
    stdout.write('To create this approval, type exactly: ' + confirmation + '\n> ')
    stdout.flush()
    require(stdin.readline(256).rstrip('\r\n') == confirmation, 'APPROVAL_NOT_GIVEN')
    unchanged(access_path, access_pin)
    unchanged(preview_path, preview_pin)
    approval = {'signer': actor, 'signature': key.sign(message).hex()}
    new_output(output_path, approval)
    stdout.write('Approval saved privately. Return only the approval JSON with the unchanged prepared body and original source to your agent. Nothing was published or paid.\n')
    stdout.flush()


class Parser(argparse.ArgumentParser):
    def error(self, unused):
        raise Refused('ARGUMENTS')


def main():
    parser = Parser(description=__doc__)
    parser.add_argument('--access', required=True, type=Path, help='Owner-private 0600 trial access JSON')
    parser.add_argument('--preview', required=True, type=Path, help='Owner-private 0600 listing.prepare JSON')
    parser.add_argument('--output', required=True, type=Path, help='NEW approval JSON; never overwritten')
    args = parser.parse_args()
    run(args.access, args.preview, args.output, stdin=sys.stdin, stdout=sys.stdout)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is Refused else 'LOCAL_CHECK_FAILED'
        print('Approval not created: ' + code + '. Keep the original files; check the owner-signing guide. No publication or payment was attempted.', file=sys.stderr)
        raise SystemExit(1)
