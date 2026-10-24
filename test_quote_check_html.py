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
"""Static checks on quote-check.html: it is self-contained and cannot send student text anywhere.

The checking logic itself is tested against the Python reference by parity.mjs (run under Node).
Made with AI agents working in MV2's name.
"""
from __future__ import annotations

import os
import re
import unittest
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "quote-check.html")

# Tags that would load or send something.
LOADING_TAGS = {"link", "img", "iframe", "frame", "object", "embed", "form", "base",
                "audio", "video", "source", "track", "picture", "svg", "meta-refresh"}
# Script APIs that could reach the network or run fetched code.
NETWORK_APIS = ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource",
                "import(", "importScripts", "Worker(", "eval(", "new Function", "innerHTML",
                "document.write", ".src", "location"]


class _Collect(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: list[tuple[str, dict[str, str | None]]] = []
        self.scripts: list[tuple[dict[str, str | None], str]] = []
        self._in_script: dict[str, str | None] | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.tags.append((tag, d))
        if tag == "script":
            self._in_script = d
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "script" and self._in_script is not None:
            self.scripts.append((self._in_script, "".join(self._buf)))
            self._in_script = None

    def handle_data(self, data):
        if self._in_script is not None:
            self._buf.append(data)


def _parse() -> tuple[str, _Collect]:
    with open(PAGE, "r", encoding="utf-8") as fh:
        text = fh.read()
    p = _Collect()
    p.feed(text)
    p.close()
    return text, p


class SelfContainedTests(unittest.TestCase):
    def setUp(self):
        self.text, self.parsed = _parse()

    def test_csp_blocks_all_network(self):
        csp = [a.get("content") or "" for t, a in self.parsed.tags
               if t == "meta" and (a.get("http-equiv") or "").lower() == "content-security-policy"]
        self.assertEqual(len(csp), 1)
        self.assertIn("default-src 'none'", csp[0])
        self.assertNotIn("http", csp[0])
        self.assertNotIn("connect-src", csp[0])

    def test_no_loading_tags_or_src_attributes(self):
        for tag, attrs in self.parsed.tags:
            self.assertNotIn(tag, LOADING_TAGS, tag)
            self.assertNotIn("src", attrs, tag)
            if (attrs.get("http-equiv") or "").lower() == "refresh":
                self.fail("meta refresh")

    def test_only_link_is_the_project_repo(self):
        hrefs = [a.get("href") for t, a in self.parsed.tags if "href" in a]
        self.assertTrue(hrefs)
        for h in hrefs:
            self.assertTrue((h or "").startswith("https://github.com/munimtechnologies/"), h)

    def test_scripts_are_inline_and_offline(self):
        self.assertEqual(len(self.parsed.scripts), 2)
        for attrs, body in self.parsed.scripts:
            self.assertNotIn("src", attrs)
            for api in NETWORK_APIS:
                self.assertNotIn(api, body, api)
        self.assertNotIn("@import", self.text)
        self.assertNotIn("url(", self.text)

    def test_core_block_has_no_dom(self):
        core = [b for a, b in self.parsed.scripts if a.get("id") == "qc-core"]
        self.assertEqual(len(core), 1)
        self.assertIsNone(re.search(r"\b(document|window)\s*\.", core[0]))
        self.assertIn("var QC =", core[0])

    def test_results_are_written_as_text_not_html(self):
        ui = [b for a, b in self.parsed.scripts if a.get("id") != "qc-core"][0]
        self.assertIn("textContent", ui)

    def test_licence_and_disclosure(self):
        self.assertIn("Licensed under the Apache License, Version 2.0", self.text)
        self.assertIn("Apache-2.0", self.text)
        self.assertIsNone(re.search(r"\bMIT\b", self.text))
        self.assertIn("Made with AI agents working in his name", self.text)
        self.assertIn("MV2 of Munim, Inc.", self.text)


if __name__ == "__main__":
    unittest.main()
