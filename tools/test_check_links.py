"""Guards for the public link checker. No network."""
import unittest

import check_links as links


class LinkCheckerRules(unittest.TestCase):
    def test_self_is_not_a_scheme_source(self):
        self.assertTrue(links.allows_self(["'self'"]))
        self.assertTrue(links.allows_self(['*']))
        self.assertTrue(links.allows_self(None))
        for source in ('data:', 'blob:', 'https:', 'http:'):
            self.assertFalse(links.allows_self([source]), source)

    def test_style_src_elem_overrides_style_src(self):
        csp = "default-src 'none'; style-src 'self'; style-src-elem 'none'"
        self.assertEqual(links.element_sources(csp, 'style'), ["'none'"])
        self.assertFalse(links.allows_self(links.element_sources(csp, 'style')))
        fallback = "default-src 'none'; style-src 'self'"
        self.assertEqual(links.element_sources(fallback, 'style'), ["'self'"])

    def test_private_repo_pattern_ignores_the_docs_repository_and_prose(self):
        prose = 'The covenant project publishes github.com/covenant-common/covenant-docs and io.github.covenant-common/covenant-aap.'
        self.assertIsNone(links.PRIVATE_REPO.search(prose))
        self.assertIsNone(links.PRIVATE_REPO.search('https://github.com/covenant-common/covenant-docs/issues/1'))
        self.assertIsNotNone(links.PRIVATE_REPO.search(
            'https://github.com/covenant-common/covenant/blob/main/docs/HOSTED_PAYMENT_ACCESS.html'))

    def test_directory_link_resolves_to_index(self):
        page = links.ROOT / 'docs' / 'INSTALL.html'
        target = links.as_file(links.local_target(page, '../sandbox/'))
        self.assertEqual(target, links.ROOT / 'sandbox' / 'index.html')
        self.assertTrue(target.is_file())

    def test_javascript_and_bare_text_urls_are_collected(self):
        self.assertIn('../docs/INSTALL.html#sandbox-errors', links.js_links(
            "export const REFERENCE = '../docs/INSTALL.html#sandbox-errors';"))
        self.assertIn('https://example.test/docs', links.bare_urls(
            'See https://example.test/docs. Then stop.'))
        self.assertEqual(links.bare_urls('Use `https://example.test/mcp` only.'),
                         ['https://example.test/mcp'])


if __name__ == '__main__':
    unittest.main()
