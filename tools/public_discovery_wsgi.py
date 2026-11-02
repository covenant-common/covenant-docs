"""Serve bounded owner-provided public discovery bytes ahead of an existing WSGI app.

This module performs no file, network, account or tool access. Only configured,
exact metadata paths are intercepted. Their Host and wsgi.url_scheme must match
``origin``; a mismatch receives a generic 400, ignoring forwarding headers.
Every other request is delegated with the original objects and return value.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import re
from types import MappingProxyType
from urllib.parse import urlsplit

MAX_DOCUMENT_BYTES = 256 * 1024
MAX_CONDITIONAL_HEADER = 8192
_ALLOWED_MEDIA = {
    '/.well-known/mcp/server-card.json': ('application/mcp-server-card+json',),
    '/mcp/server-card': ('application/mcp-server-card+json',),
    '/.well-known/ai-catalog.json': ('application/ai-catalog+json',),
    '/mcp/tool-inventory.json': ('application/json',),
    '/.well-known/api-catalog': ('application/linkset+json',),
    '/auth.md': ('text/markdown', 'text/markdown; charset=utf-8'),
}
_METHODS = ('GET', 'HEAD', 'OPTIONS')


def _authority(value: str) -> tuple[str, int]:
    """Normalize an ASCII DNS/IP authority without accepting userinfo or aliases."""
    if (type(value) is not str or not value or len(value) > 260 or
            any(ord(char) <= 32 or ord(char) >= 127 for char in value)):
        raise ValueError('Invalid public origin authority')
    try:
        parsed = urlsplit('//' + value)
        host, port = parsed.hostname, parsed.port
        if (not host or parsed.username is not None or parsed.password is not None or
                parsed.path or parsed.query or parsed.fragment or parsed.netloc != value or
                value.endswith(':')):
            raise ValueError
        if ':' in host:
            host = str(ipaddress.IPv6Address(host))
        else:
            if (len(host) > 253 or not re.fullmatch(r'[A-Za-z0-9.-]+', host) or
                    any(not label or len(label) > 63 or label[0] == '-' or label[-1] == '-'
                        for label in host.split('.'))):
                raise ValueError
            host = host.lower()
        if port is not None and not 1 <= port <= 65535:
            raise ValueError
    except (ValueError, TypeError, UnicodeError) as error:
        raise ValueError('Invalid public origin authority') from error
    return host, port or 443


def _origin_authority(origin: str) -> tuple[str, int]:
    if (type(origin) is not str or len(origin) > 2048 or
            any(ord(char) <= 32 or ord(char) >= 127 for char in origin)):
        raise ValueError('Invalid public HTTPS origin')
    try:
        parsed = urlsplit(origin)
        if (parsed.scheme != 'https' or parsed.path not in ('', '/') or
                parsed.query or parsed.fragment or '?' in origin or '#' in origin):
            raise ValueError
        return _authority(parsed.netloc)
    except ValueError as error:
        raise ValueError('Invalid public HTTPS origin') from error


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate metadata key')
        result[key] = value
    return result


def _finite_float(value):
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError('Nonfinite metadata number')
    return parsed


def _reject_constant(_value):
    raise ValueError('Nonfinite metadata number')


def _validate_json(body: bytes) -> None:
    try:
        parsed = json.loads(body.decode('utf-8'), object_pairs_hook=_unique_object,
                            parse_float=_finite_float, parse_constant=_reject_constant)
        if type(parsed) is not dict:
            raise ValueError('Metadata must be a JSON object')
    except (ValueError, UnicodeError, RecursionError) as error:
        raise ValueError('Invalid public JSON metadata') from error


class PublicDiscoveryWSGI:
    """An exact-path, immutable-byte adapter; it never broadens the wrapped API.

    ``documents`` is a plain dict of allowlisted absolute paths to
    ``(content_type, bytes)`` pairs. Subsets and an empty mapping are permitted.
    Metadata requires an explicit HTTP_HOST and HTTPS WSGI scheme; untrusted
    X-Forwarded-* headers cannot satisfy those checks. Nonmetadata requests are
    always delegated unchanged, even when their host or scheme differs.
    """

    def __init__(self, application, documents: dict[str, tuple[str, bytes]],
                 origin: str = 'https://jupie202020.pythonanywhere.com'):
        if not callable(application):
            raise TypeError('application must be callable')
        if type(documents) is not dict:
            raise TypeError('documents must be a plain dict')
        authority = _origin_authority(origin)
        prepared = {}
        for path, pair in documents.items():
            if type(path) is not str or path not in _ALLOWED_MEDIA:
                raise ValueError('Unsupported public metadata path')
            if type(pair) is not tuple or len(pair) != 2:
                raise TypeError('metadata entry must be a content-type and bytes pair')
            media, body = pair
            if type(media) is not str or media not in _ALLOWED_MEDIA[path]:
                raise ValueError('Unsupported public metadata content type')
            if type(body) is not bytes:
                raise TypeError('metadata body must be bytes')
            if len(body) > MAX_DOCUMENT_BYTES:
                raise ValueError('Public metadata exceeds the size limit')
            if media.startswith('application/'):
                _validate_json(body)
            else:
                try:
                    text = body.decode('utf-8')
                except UnicodeError as error:
                    raise ValueError('Public Markdown must be UTF-8') from error
                if '\x00' in text:
                    raise ValueError('Public Markdown contains a NUL')
            tag = '"sha256-' + hashlib.sha256(body).hexdigest() + '"'
            prepared[path] = (media, body, tag)
        self.application = application
        self._authority = authority
        self._documents = MappingProxyType(prepared)

    @staticmethod
    def _headers():
        return [
            ('Cache-Control', 'public, max-age=300'),
            ('X-Content-Type-Options', 'nosniff'),
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, If-None-Match'),
            ('Access-Control-Expose-Headers', 'ETag'),
        ]

    def _error(self, start_response, status, body, head=False, allow=False):
        headers = self._headers()
        # Invalid requests must not leave a public error cached as a document.
        headers[0] = ('Cache-Control', 'no-store')
        headers.extend([('Content-Type', 'text/plain; charset=utf-8'),
                        ('Content-Length', str(len(body)))])
        if allow:
            headers.append(('Allow', 'GET, HEAD, OPTIONS'))
        start_response(status, headers)
        return [] if head else [body]

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO')
        if type(path) is not str or path not in self._documents:
            return self.application(environ, start_response)

        method = environ.get('REQUEST_METHOD')
        head = method == 'HEAD'
        try:
            valid_origin = (environ.get('wsgi.url_scheme') == 'https' and
                            _authority(environ.get('HTTP_HOST')) == self._authority)
        except ValueError:
            valid_origin = False
        if not valid_origin:
            return self._error(start_response, '400 Bad Request', b'Bad request.\n', head)
        if type(method) is not str or method not in _METHODS:
            return self._error(start_response, '405 Method Not Allowed',
                               b'Method not allowed.\n', head, allow=True)

        media, body, tag = self._documents[path]
        headers = self._headers() + [('ETag', tag)]
        if method == 'OPTIONS':
            headers.extend([('Allow', 'GET, HEAD, OPTIONS'),
                            ('Access-Control-Max-Age', '300'), ('Content-Length', '0')])
            start_response('204 No Content', headers)
            return []
        conditional = environ.get('HTTP_IF_NONE_MATCH')
        if conditional is not None:
            if (type(conditional) is not str or len(conditional) > MAX_CONDITIONAL_HEADER or
                    any(ord(char) < 32 and char != '\t' or ord(char) == 127
                        for char in conditional)):
                return self._error(start_response, '400 Bad Request', b'Bad request.\n', head)
            # If-None-Match uses weak comparison for GET and HEAD. Our generated
            # opaque tags contain no commas or escapes, so other list tokens
            # cannot ambiguously compare equal to them.
            tokens = (token.strip() for token in conditional.split(','))
            if any(token == '*' or (token[2:] if token.startswith('W/') else token) == tag
                   for token in tokens):
                start_response('304 Not Modified', headers)
                return []
        headers.extend([('Content-Type', media), ('Content-Length', str(len(body)))])
        start_response('200 OK', headers)
        return [] if head else [body]
