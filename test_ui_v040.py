# Copyright 2026 Munim, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Static checks on v0.4.0's additions to quote-check.html: the "Changed quotes first" box is off by
default, the new text exists in both languages, and the interface uses the qc-text helpers.

node_test_order.mjs runs the same additions end to end under Node.
Made with AI agents working in MV2's name.
"""
from __future__ import annotations

import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "quote-check.html")
NEW_KEYS = ("th_words", "th_look", "look_close_one", "look_close_other", "look_loose", "order_label",
            "note_look")
CSP = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; "
       "form-action 'none'")


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


class V040Tests(unittest.TestCase):
    def setUp(self):
        self.text = _read(PAGE)

    def _ui(self) -> str:
        m = re.search(r"<script>\r?\n([\s\S]*?)</script>", self.text)
        self.assertIsNotNone(m)
        return m.group(1)

    def test_order_box_is_off_by_default(self):
        boxes = re.findall(r'<input[^>]*\bid="order"[^>]*>', self.text)
        self.assertEqual(len(boxes), 1)
        self.assertIn('type="checkbox"', boxes[0])
        self.assertNotIn("checked", boxes[0])

    def test_markdown_box_is_still_on(self):
        boxes = re.findall(r'<input[^>]*\bid="md"[^>]*>', self.text)
        self.assertEqual(len(boxes), 1)
        self.assertIn("checked", boxes[0])

    def test_new_text_in_english_and_spanish(self):
        for key in NEW_KEYS:
            self.assertEqual(len(re.findall(r"^\s+%s: \"" % key, self.text, re.M)), 2, key)

    def test_interface_uses_the_helpers(self):
        ui = self._ui()
        for needle in ("QT.order(", "QT.look(", "QT.differ(", '"th_words"', '"th_look"',
                       'getElementById("order")'):
            self.assertIn(needle, ui)

    def test_csp_unchanged(self):
        self.assertEqual(self.text.count('content="%s"' % CSP), 1)

    def test_version_is_noted(self):
        self.assertIn("v0.4.0:", self.text)


if __name__ == "__main__":
    unittest.main()
