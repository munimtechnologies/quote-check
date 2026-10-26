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
"""Tests for build_page.py. Made with AI agents working in MV2's name."""
from __future__ import annotations

import unittest

import build_page as bp

CORE = '<script id="qc-core">\nvar QC = 1; //   　 odd spaces\r\n</script>'
BASE = "<html><body>old ui\n" + CORE + "\n<script>old()</script></body></html>"


class BuildTests(unittest.TestCase):
    def test_core_is_carried_over_byte_for_byte(self):
        page = bp.build(BASE, "<p>new</p>\n<!-- QC-CORE -->\n<script>new()</script>")
        self.assertEqual(page, "<p>new</p>\n" + CORE + "\n<script>new()</script>")
        self.assertEqual(bp.core_block(page), CORE)

    def test_marker_must_appear_once(self):
        with self.assertRaises(ValueError):
            bp.build(BASE, "no marker")
        with self.assertRaises(ValueError):
            bp.build(BASE, "<!-- QC-CORE --><!-- QC-CORE -->")

    def test_base_must_have_one_core_block(self):
        with self.assertRaises(ValueError):
            bp.build("<html></html>", "<!-- QC-CORE -->")
        with self.assertRaises(ValueError):
            bp.build(CORE + CORE, "<!-- QC-CORE -->")

    def test_template_must_not_carry_its_own_core(self):
        with self.assertRaises(ValueError):
            bp.build(BASE, CORE + "<!-- QC-CORE -->")


if __name__ == "__main__":
    unittest.main()
