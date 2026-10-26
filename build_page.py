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
"""Build quote-check.html v0.2.0: the new interface around v0.1.0's checking code, byte for byte.

The checking logic (<script id="qc-core">) is cut from the released v0.1.0 page and put where the
template says <!-- QC-CORE -->, so the parity tests against the Python reference still describe
exactly the code teachers run. Made with AI agents working in MV2's name.

    python build_page.py --base quote-check-v010.html --template page-template.html \
        --out quote-check.html [--copy-to /out/quote-check.html]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys

CORE_RE = re.compile(r'<script id="qc-core">[\s\S]*?</script>')
MARKER = "<!-- QC-CORE -->"


def _read(path: str) -> str:
    # newline="" keeps the bytes as they are (no CRLF translation either way).
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


def core_block(html: str) -> str:
    found = CORE_RE.findall(html)
    if len(found) != 1:
        raise ValueError(f"expected one qc-core block, found {len(found)}")
    return found[0]


def build(base_html: str, template: str) -> str:
    if template.count(MARKER) != 1:
        raise ValueError(f"template must contain {MARKER} exactly once")
    if CORE_RE.search(template):
        raise ValueError("template already contains a qc-core block")
    return template.replace(MARKER, core_block(base_html))


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base", required=True)
    ap.add_argument("--template", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--copy-to", default="")
    args = ap.parse_args(argv)
    base = _read(args.base)
    page = build(base, _read(args.template))
    if core_block(page) != core_block(base):
        raise SystemExit("qc-core block changed while building")
    for path in [args.out] + ([args.copy_to] if args.copy_to else []):
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(page)
    print(json.dumps({"base_sha256": _sha(base), "core_sha256": _sha(core_block(page)),
                      "page_sha256": _sha(page), "page_bytes": len(page.encode("utf-8"))}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
