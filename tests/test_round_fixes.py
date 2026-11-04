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
        text = re.sub(r'<[^>]+>', '', (ROOT / 'docs' / 'DISPUTES.html').read_text())
        for label in ('Dispute window', 'Evidence window', 'Capture deadline'):
            self.assertIn(label + ': TODO(owner) days', text)

    def test_review_example_is_the_wrapped_empty_case(self):
        wrapped = json.loads((ROOT / 'distribution' / 'review-empty-case.json').read_text())
        page = (ROOT / 'docs' / 'PUBLIC_TASKS.html').read_text()
        self.assertEqual(wrapped['case']['version'], 'covenant-coordination-case/0.1')
        self.assertIn(wrapped['case']['title'], page)
        self.assertIn(wrapped['case']['version'], page)

    def test_deliver_and_resolve_do_not_redirect(self):
        for name in ('DELIVER.html', 'RESOLVE.html'):
            text = (ROOT / 'docs' / name).read_text()
            self.assertNotIn('http-equiv="refresh"', text)


if __name__ == '__main__':
    unittest.main()
