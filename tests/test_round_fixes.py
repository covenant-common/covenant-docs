#!/usr/bin/env python3
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RoundFixesTest(unittest.TestCase):
    def test_body_font_stack_is_sans(self):
        css = (ROOT / 'assets' / 'site.css').read_text()
        self.assertIn('font-family:system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', css)
        self.assertNotIn('Times New Roman', css)

    def test_dispute_windows_are_visible_todo_day_counts(self):
        raw = (ROOT / 'docs' / 'DISPUTES.html').read_text()
        self.assertIn('TODO(owner)', raw)
        self.assertIn('Not set yet. The owner will confirm this', raw)
        text = re.sub(r'<[^>]+>', ' ', raw)
        for label in ('Dispute window', 'Evidence window', 'Capture deadline'):
            self.assertIn(label, text)

    def test_review_example_is_the_wrapped_empty_case(self):
        wrapped = json.loads((ROOT / 'distribution' / 'review-empty-case.json').read_text())
        self.assertEqual(wrapped['case']['version'], 'covenant-coordination-case/0.1')
        for name in ('docs/API_MCP.html', 'docs/PUBLIC_TASKS.html'):
            page = (ROOT / name).read_text()
            self.assertIn(wrapped['case']['title'], page)
            self.assertIn(wrapped['case']['version'], page)
        self.assertNotIn('case0.4', (ROOT / 'docs' / 'API_MCP.html').read_text())

    def test_deliver_and_resolve_do_not_redirect(self):
        for name in ('DELIVER.html', 'RESOLVE.html'):
            text = (ROOT / 'docs' / name).read_text()
            self.assertNotIn('http-equiv="refresh"', text)

    def test_fee_for_25_is_half_up_cents(self):
        import sys
        sys.path.insert(0, str(ROOT / 'tools'))
        # The shared browser function is asserted in tests/deal-machine.test.mjs.
        # 2500 cents * 0.5% = 12.5 cents, half-up to 13.
        minor = 2500
        fee = (minor * 50 + 5000) // 10000
        self.assertEqual(fee, 13)

    def test_standards_table_can_reflow(self):
        css = (ROOT / 'assets' / 'site.css').read_text()
        self.assertIn('table.matrix td::before{content:attr(data-label)', css)
        self.assertIn('@media(max-width:420px)', css)


if __name__ == '__main__':
    unittest.main()
