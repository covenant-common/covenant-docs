#!/usr/bin/env python3
"""The Scaling Trust pages stay planned until the registry lists them."""
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))

ROOT = Path(__file__).resolve().parents[1]
PLANNED_TOOLS = (
    'covenant_deal__message',
    'covenant_sandbox__circuit',
    'covenant_review__attestations',
    'covenant_ops__incident_report',
    'covenant_review__audit_bundle',
    'covenant_negotiate__private_open',
)


class ScalingTrustDocsTest(unittest.TestCase):
    def test_registry_does_not_list_the_planned_tools(self):
        from registry_view import registry_list_sentence, registry_lists
        projection = json.loads((ROOT / 'distribution' / 'capability-registry.json').read_text())
        page = (ROOT / 'docs' / 'SCALING_TRUST.html').read_text()
        sentence = registry_list_sentence(projection, ('covenant_deal__message', 'structured_channel'))
        self.assertIn(sentence, page)
        attest = registry_list_sentence(projection, ('attestation_types', 'covenant_review__attestations'))
        self.assertIn(attest, page)
        breakers = registry_list_sentence(projection, ('covenant_sandbox__circuit', 'limits', 'retry_after'))
        self.assertIn(breakers, page)
        if not registry_lists(projection, 'retry_after'):
            self.assertNotIn('intended signal', page)
            self.assertNotIn('will return', page)
        raw = json.loads((ROOT / 'distribution' / 'capability-registry.server.json').read_text())
        sandbox = raw['sandbox']
        self.assertTrue(sandbox['test_mode'])
        self.assertFalse(sandbox['can_pay_real_funds'])
        self.assertIsNone(sandbox['platform_fee_bps'])

    def test_pages_call_unshipped_features_planned(self):
        page = (ROOT / 'docs' / 'SCALING_TRUST.html').read_text()
        self.assertIn('>Planned<', page)
        self.assertIn('Not set yet. The owner will confirm this', page)
        self.assertIn('TODO(owner): dispute bond amount', page)
        self.assertNotIn('circuit breaker is live', page.lower())
        self.assertNotIn('covenant_deal__message</code> is available', page)
        visible = re.sub(r'<!--.*?-->', ' ', page, flags=re.DOTALL)
        self.assertNotIn('TODO(owner)', visible)
        llms = (ROOT / 'llms.txt').read_text()
        self.assertIn('Status is Planned, not working', llms)
        self.assertIn('amount is not set yet', llms)
        self.assertNotIn('TODO(owner)', llms)

    def test_why_page_cites_only_listed_sources(self):
        sources = (ROOT / 'testing' / 'scaling-trust' / 'sources.md').read_text()
        allowed = set(re.findall(r'https://[^\s\)>]+', sources))
        page = (ROOT / 'docs' / 'WHY_THIS_WAY.html').read_text()
        for url in re.findall(r'href="(https://[^"]+)"', page):
            if url.startswith('https://covenant-common.github.io/'):
                continue
            self.assertIn(url, allowed, url)
        arena = (ROOT / 'docs' / 'ARENA_READINESS.html').read_text()
        self.assertIn('Aspirational', arena)
        self.assertNotIn('Register your interest', arena)
        for url in re.findall(r'href="(https://[^"]+)"', arena):
            if url.startswith('https://covenant-common.github.io/'):
                continue
            self.assertIn(url, allowed, url)


if __name__ == '__main__':
    unittest.main()
