"""Focused security and exact pass-through checks for public discovery WSGI."""
from __future__ import annotations

import hashlib
import io
import json
import unittest
from wsgiref.validate import validator

try:
    from .public_discovery_wsgi import PublicDiscoveryWSGI, MAX_DOCUMENT_BYTES
except ImportError:
    from public_discovery_wsgi import PublicDiscoveryWSGI, MAX_DOCUMENT_BYTES


ORIGIN = 'https://jupie202020.pythonanywhere.com'
HOST = 'jupie202020.pythonanywhere.com'
CARD = '/.well-known/mcp/server-card.json'
DOCS = {
    CARD: ('application/mcp-server-card+json', b'{"title":"public"}\n'),
    '/mcp/server-card': ('application/mcp-server-card+json', b'{"title":"public"}\n'),
    '/.well-known/ai-catalog.json': ('application/ai-catalog+json', b'{"entries":[]}\n'),
    '/mcp/tool-inventory.json': ('application/json', b'{"tools":[]}\n'),
    '/.well-known/api-catalog': ('application/linkset+json', b'{"linkset":[]}\n'),
    '/auth.md': ('text/markdown; charset=utf-8', b'# Public access\nNo sign in.\n'),
}


class BombInput:
    def read(self, *args):
        raise AssertionError('request body was read')

    readline = read
    readlines = read
    __iter__ = read


class Upstream:
    def __init__(self):
        self.calls = []
        self.response = iter([b'upstream\x00', b'unchanged'])

    def __call__(self, environ, start_response):
        self.calls.append((environ, start_response))
        return self.response


def request(app, path=CARD, method='GET', **changes):
    environ = {'PATH_INFO': path, 'REQUEST_METHOD': method,
               'wsgi.url_scheme': 'https', 'HTTP_HOST': HOST,
               'wsgi.input': BombInput()}
    environ.update(changes)
    captured = {}

    def start_response(status, headers, exc_info=None):
        captured.update(status=status, headers=headers, exc_info=exc_info)

    returned = app(environ, start_response)
    captured['body'] = b''.join(returned)
    captured['environ'] = environ
    captured['header_map'] = dict(captured.get('headers', []))
    return captured


class PublicDiscoveryRequestTests(unittest.TestCase):
    def setUp(self):
        self.upstream = Upstream()
        self.app = PublicDiscoveryWSGI(self.upstream, dict(DOCS))

    def test_all_six_exact_paths_serve_prebuilt_bytes_without_body_access(self):
        for path, (media, body) in DOCS.items():
            with self.subTest(path=path):
                result = request(self.app, path, QUERY_STRING='private=value')
                self.assertEqual(result['status'], '200 OK')
                self.assertEqual(result['body'], body)
                self.assertEqual(result['header_map']['Content-Type'], media)
                self.assertEqual(result['header_map']['Content-Length'], str(len(body)))
                self.assertNotIn(b'private', result['body'])
        self.assertEqual(self.upstream.calls, [])

    def test_head_has_the_get_length_and_no_body(self):
        get = request(self.app)
        head = request(self.app, method='HEAD')
        self.assertEqual(head['status'], '200 OK')
        self.assertEqual(head['body'], b'')
        self.assertEqual(head['headers'], get['headers'])

    def test_options_has_no_body_and_is_public(self):
        result = request(self.app, method='OPTIONS', HTTP_ORIGIN='https://consumer.example',
                         HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET')
        self.assertEqual(result['status'], '204 No Content')
        self.assertEqual(result['body'], b'')
        self.assertEqual(result['header_map']['Allow'], 'GET, HEAD, OPTIONS')
        self.assertEqual(result['header_map']['Content-Length'], '0')
        self.assertEqual(result['header_map']['Access-Control-Max-Age'], '300')

    def test_cache_cors_nosniff_and_body_hash(self):
        result = request(self.app)
        headers = result['header_map']
        self.assertEqual(headers['Cache-Control'], 'public, max-age=300')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(headers['Access-Control-Allow-Origin'], '*')
        self.assertEqual(headers['Access-Control-Allow-Methods'], 'GET, HEAD, OPTIONS')
        self.assertEqual(headers['Access-Control-Allow-Headers'], 'Content-Type, If-None-Match')
        self.assertEqual(headers['Access-Control-Expose-Headers'], 'ETag')
        self.assertNotIn('Access-Control-Allow-Credentials', headers)
        self.assertEqual(headers['ETag'], '"sha256-' + hashlib.sha256(DOCS[CARD][1]).hexdigest() + '"')

    def test_conditional_get_and_head_weak_list_and_wildcard(self):
        tag = request(self.app)['header_map']['ETag']
        for method in ['GET', 'HEAD']:
            for condition in [tag, 'W/' + tag, '"other", W/' + tag, '*', ' \t' + tag + '\t ']:
                with self.subTest(method=method, condition=condition):
                    result = request(self.app, method=method, HTTP_IF_NONE_MATCH=condition)
                    self.assertEqual(result['status'], '304 Not Modified')
                    self.assertEqual(result['body'], b'')
                    self.assertEqual(result['header_map']['ETag'], tag)
                    self.assertNotIn('Content-Length', result['header_map'])

    def test_nonmatching_condition_returns_the_actual_document(self):
        for condition in ['"other"', 'W/"other"', '', 'W/*', '"sha256-other"']:
            with self.subTest(condition=condition):
                result = request(self.app, HTTP_IF_NONE_MATCH=condition)
                self.assertEqual(result['status'], '200 OK')
                self.assertEqual(result['body'], DOCS[CARD][1])

    def test_metadata_post_put_delete_never_reach_upstream_or_read_body(self):
        for method in ['POST', 'PUT', 'PATCH', 'DELETE', 'TRACE', 'get', '', None, []]:
            with self.subTest(method=method):
                result = request(self.app, method=method)
                self.assertEqual(result['status'], '405 Method Not Allowed')
                self.assertEqual(result['header_map']['Allow'], 'GET, HEAD, OPTIONS')
                self.assertNotIn(b'upstream', result['body'])
        self.assertEqual(self.upstream.calls, [])

    def test_origin_mismatch_is_generic_400_and_does_not_trust_forwarded_headers(self):
        cases = [
            {'HTTP_HOST': 'attacker.example'},
            {'HTTP_HOST': HOST + '.attacker.example'},
            {'HTTP_HOST': HOST + ':444'},
            {'HTTP_HOST': 'user@' + HOST},
            {'HTTP_HOST': HOST + '\r\nX-Secret: injected'},
            {'HTTP_HOST': HOST + '?'}, {'HTTP_HOST': HOST + '#'},
            {'HTTP_HOST': HOST + '/'}, {'HTTP_HOST': HOST + ',' + HOST},
            {'HTTP_HOST': 'x' * 261}, {'HTTP_HOST': None},
            {'HTTP_HOST': HOST + '.'}, {'HTTP_HOST': HOST + ':'},
            {'wsgi.url_scheme': 'http', 'HTTP_X_FORWARDED_PROTO': 'https'},
            {'HTTP_HOST': 'attacker.example', 'HTTP_X_FORWARDED_HOST': HOST,
             'HTTP_FORWARDED': 'proto=https;host=' + HOST},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                result = request(self.app, **changes)
                self.assertEqual(result['status'], '400 Bad Request')
                self.assertEqual(result['body'], b'Bad request.\n')
                self.assertEqual(result['header_map']['Cache-Control'], 'no-store')
        self.assertEqual(self.upstream.calls, [])

    def test_missing_host_does_not_fall_back_to_server_name_or_forwarded_host(self):
        env = {'PATH_INFO': CARD, 'REQUEST_METHOD': 'GET', 'wsgi.url_scheme': 'https',
               'SERVER_NAME': HOST, 'SERVER_PORT': '443', 'HTTP_X_FORWARDED_HOST': HOST,
               'wsgi.input': BombInput()}
        capture = {}
        returned = self.app(env, lambda status, headers: capture.update(status=status))
        self.assertEqual(capture['status'], '400 Bad Request')
        self.assertEqual(b''.join(returned), b'Bad request.\n')

    def test_host_case_default_port_and_configured_port(self):
        for host in [HOST.upper(), HOST + ':443']:
            self.assertEqual(request(self.app, HTTP_HOST=host)['status'], '200 OK')
        other = PublicDiscoveryWSGI(self.upstream, dict(DOCS), origin='https://' + HOST + ':8443')
        self.assertEqual(request(other, HTTP_HOST=HOST + ':8443')['status'], '200 OK')
        self.assertEqual(request(other)['status'], '400 Bad Request')

    def test_condition_header_bounds_and_injection_cannot_echo_or_call_upstream(self):
        for condition in ['x' * 8193, '"x"\r\nAuthorization: SECRET', '\x00', '\x7f', 4, []]:
            with self.subTest(condition=repr(condition)[:40]):
                result = request(self.app, HTTP_IF_NONE_MATCH=condition)
                self.assertEqual(result['status'], '400 Bad Request')
                self.assertEqual(result['body'], b'Bad request.\n')
                self.assertNotIn(b'SECRET', result['body'])
        self.assertEqual(self.upstream.calls, [])

    def test_head_errors_remain_bodyless(self):
        self.assertEqual(request(self.app, method='HEAD', HTTP_HOST='wrong.example')['body'], b'')
        self.assertEqual(request(self.app, method='HEAD', HTTP_IF_NONE_MATCH='x' * 8193)['body'], b'')

    def test_caller_mapping_mutation_cannot_replace_approved_bytes(self):
        documents = dict(DOCS)
        app = PublicDiscoveryWSGI(self.upstream, documents)
        documents[CARD] = ('application/mcp-server-card+json', b'{"secret":"new"}')
        documents.clear()
        self.assertEqual(request(app)['body'], DOCS[CARD][1])

    def test_wsgi_validator_success_head_and_error_paths(self):
        wrapped = validator(self.app)
        for method in ['GET', 'HEAD', 'OPTIONS', 'POST']:
            with self.subTest(method=method):
                environ = {'REQUEST_METHOD': method, 'SCRIPT_NAME': '', 'PATH_INFO': CARD,
                    'QUERY_STRING': '', 'SERVER_NAME': HOST, 'SERVER_PORT': '443',
                    'SERVER_PROTOCOL': 'HTTP/1.1', 'HTTP_HOST': HOST,
                    'wsgi.version': (1, 0), 'wsgi.url_scheme': 'https',
                    'wsgi.input': io.BytesIO(b''), 'wsgi.errors': io.StringIO(),
                    'wsgi.multithread': False, 'wsgi.multiprocess': False, 'wsgi.run_once': False}
                response = wrapped(environ, lambda status, headers, exc_info=None: lambda body: None)
                try:
                    list(response)
                finally:
                    response.close()


class ExactPassThroughTests(unittest.TestCase):
    def test_nonmetadata_request_preserves_objects_return_value_and_body(self):
        for path in ['/mcp', '/mcp/account/v1', '/private/customer', '/auth.md/',
                     '/mcp/server-card/', '/%2e%2e/auth.md', '/%61uth.md',
                     '/mcp%2fserver-card', '//auth.md', '/AUTH.MD', '/auth.md\x00',
                     CARD + '?token=secret', None, [], {}]:
            for method in ['GET', 'POST', 'OPTIONS']:
                with self.subTest(path=path, method=method):
                    upstream = Upstream()
                    app = PublicDiscoveryWSGI(upstream, dict(DOCS))
                    environ = {'PATH_INFO': path, 'REQUEST_METHOD': method, 'HTTP_HOST': 'other',
                        'wsgi.url_scheme': 'http', 'wsgi.input': BombInput(),
                        'HTTP_AUTHORIZATION': 'Bearer retained-only-for-upstream'}
                    before = dict(environ)
                    start = object()
                    returned = app(environ, start)
                    self.assertIs(returned, upstream.response)
                    self.assertIs(upstream.calls[0][0], environ)
                    self.assertIs(upstream.calls[0][1], start)
                    self.assertEqual(environ, before)
                    self.assertEqual(list(returned), [b'upstream\x00', b'unchanged'])

    def test_unconfigured_allowlisted_path_is_also_unchanged(self):
        upstream = Upstream()
        app = PublicDiscoveryWSGI(upstream, {'/auth.md': DOCS['/auth.md']})
        environ = {'PATH_INFO': CARD, 'REQUEST_METHOD': 'POST', 'wsgi.input': BombInput()}
        sentinel = object()
        self.assertIs(app(environ, sentinel), upstream.response)
        self.assertEqual(upstream.calls, [(environ, sentinel)])

    def test_upstream_start_response_exc_info_write_and_close_are_unmodified(self):
        seen = {}
        token = object()
        class Response:
            def __iter__(self):
                yield b'preserved'
            def close(self):
                seen['closed'] = True
        iterator = Response()
        error_info = (ValueError, ValueError('upstream'), None)
        def start(status, headers, exc_info=None):
            seen.update(status=status, headers=headers, error=exc_info)
            return token
        def app(environ, start_response):
            seen['writer'] = start_response('418 Upstream', [('X-Upstream', 'untouched')], error_info)
            return iterator
        wrapped = PublicDiscoveryWSGI(app, dict(DOCS))
        returned = wrapped({'PATH_INFO': '/mcp/account/v1'}, start)
        self.assertIs(returned, iterator)
        self.assertIs(seen['error'], error_info)
        self.assertIs(seen['writer'], token)
        self.assertEqual(seen['headers'], [('X-Upstream', 'untouched')])
        returned.close()
        self.assertTrue(seen['closed'])

    def test_upstream_exception_is_not_caught_or_replaced(self):
        exception = RuntimeError('upstream failure')
        def app(environ, start_response):
            raise exception
        with self.assertRaises(RuntimeError) as caught:
            PublicDiscoveryWSGI(app, dict(DOCS))({'PATH_INFO': '/mcp'}, object())
        self.assertIs(caught.exception, exception)

    def test_empty_mapping_delegates_everything(self):
        upstream = Upstream()
        app = PublicDiscoveryWSGI(upstream, {})
        self.assertIs(app({'PATH_INFO': CARD}, object()), upstream.response)


class ConstructionTests(unittest.TestCase):
    def test_invalid_application_and_mapping_are_rejected(self):
        for app in [None, 1, 'callable']:
            with self.subTest(app=app), self.assertRaises(TypeError):
                PublicDiscoveryWSGI(app, {})
        for mapping in [None, [], (), {'bad'}, 1]:
            with self.subTest(mapping=mapping), self.assertRaises(TypeError):
                PublicDiscoveryWSGI(Upstream(), mapping)

    def test_only_exact_allowlisted_absolute_paths(self):
        for path in ['/mcp', '/mcp/account/v1', '../auth.md', 'auth.md', '/auth.md/',
                     '//auth.md', '/auth.md?x=y', '/auth.md\r\nX: y', 1, ('/auth.md',)]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                PublicDiscoveryWSGI(Upstream(), {path: ('text/markdown', b'public')})

    def test_pair_type_bytes_and_exact_media_are_checked(self):
        cases = [
            (['text/markdown', b'hello'], TypeError),
            (('text/markdown',), TypeError),
            (('text/markdown', 'hello'), TypeError),
            (('text/markdown', bytearray(b'hello')), TypeError),
            (('text/html', b'hello'), ValueError),
            (('text/markdown\r\nSet-Cookie: secret', b'hello'), ValueError),
            ((None, b'hello'), ValueError),
        ]
        for pair, error in cases:
            with self.subTest(pair=pair), self.assertRaises(error):
                PublicDiscoveryWSGI(Upstream(), {'/auth.md': pair})
        with self.assertRaises(ValueError):
            PublicDiscoveryWSGI(Upstream(), {CARD: ('application/json', b'{}')})

    def test_maximum_document_is_accepted_but_larger_refused(self):
        body = b'{}' + b' ' * (MAX_DOCUMENT_BYTES - 2)
        app = PublicDiscoveryWSGI(Upstream(), {CARD: ('application/mcp-server-card+json', body)})
        self.assertEqual(request(app)['body'], body)
        with self.assertRaises(ValueError):
            PublicDiscoveryWSGI(Upstream(), {CARD: ('application/mcp-server-card+json', body + b' ')})

    def test_malformed_ambiguous_nonfinite_or_nonutf8_json_is_rejected(self):
        for body in [b'', b'{', b'[]', b'null', b'{"x":1,"x":2}', b'{"x":NaN}',
                     b'{"x":Infinity}', b'{"x":1e9999}', b'{"x":"\xff"}',
                     b'\xff\xfe{\x00}\x00', b'[' * 2000 + b']' * 2000]:
            with self.subTest(body=body[:30]), self.assertRaises(ValueError):
                PublicDiscoveryWSGI(Upstream(), {CARD: ('application/mcp-server-card+json', body)})

    def test_bad_markdown_is_rejected_without_reading_files(self):
        for body in [b'\xff', b'hello\x00private']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                PublicDiscoveryWSGI(Upstream(), {'/auth.md': ('text/markdown', body)})

    def test_origin_requires_a_real_https_origin_not_a_path_or_header(self):
        for origin in ['http://' + HOST, 'https://' + HOST + '/mcp',
                       'https://' + HOST + '?token=x', 'https://' + HOST + '?',
                       'https://' + HOST + '#', 'https://user:secret@' + HOST,
                       'https://' + HOST + '\r\nX: injected', 'https://',
                       'https://' + HOST + ':0', 'https://' + HOST + ':65536',
                       'https://' + HOST + ':no', None, [], 'https://-bad.example']:
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                PublicDiscoveryWSGI(Upstream(), {}, origin=origin)

    def test_custom_ipv6_origin_has_no_network_lookup(self):
        app = PublicDiscoveryWSGI(Upstream(), {'/auth.md': DOCS['/auth.md']},
                                  origin='https://[2001:db8::1]:8443')
        self.assertEqual(request(app, '/auth.md', HTTP_HOST='[2001:db8::1]:8443')['status'], '200 OK')


if __name__ == '__main__':
    unittest.main()
