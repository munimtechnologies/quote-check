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
"""Parity cases for quote-check.html: the Python reference's answers on synthetic text.

Runs verbatim_quote_check.py (feedback-commons tools/, tag v0.8.0) on seeded, synthetic
student-like sentences and mutated quotes (exact slices, case and punctuation changes, dropped,
inserted, swapped and replaced words, NFD text, odd whitespace and quote marks, thresholds 0..1)
and writes the category, similarity and word tokens for each, so parity.mjs can check that the
JavaScript port answers identically. No real student text is used.
Made with AI agents working in MV2's name.

    python make_cases.py --out cases.json [--per-source 320] [--seed qcheck-parity-v1]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import unicodedata

import verbatim_quote_check as vqc

# Synthetic, written for this test. Misspellings, apostrophes, digits, accents, NFD, Greek,
# Turkish dotted I, CJK, Devanagari (combining marks split words), underscores, a BOM, an
# ideographic space and a file separator (both whitespace to Python's str.strip()).
SOURCES = [
    "My favorite subjet in school is science because we do experimens every week. Last year our "
    "teacher let us build a volcano, and it was the best day of the hole year!",
    "Some people think that students should have homework every day, but i dont agree. Homework can "
    "be usefull, however too much of it make students tired and they lose there interest.",
    "In my opinion, technology helps students learn faster.  For example, with a computer you can "
    "search informations in seconds; in the past you needed to go to the library.",
    "The café near my house opened in 2019. Its coffee costs 3.50 dollars, and the owner’s "
    "daughter — María — works there after school.",
    "“Be kind,” my grandmother always said. She grew up in İstanbul and moved to "
    "Straße 12 in Berlin when she was 20 years old.",
    "ΟΔΟΣ means road in Greek, and 我们学习 means we study in "
    "Chinese. नमस्ते is a greeting in Hindi.",
    "snake_case_names and camelCase are both ways to write variable names; the first one uses an "
    "underscore.",
    "﻿The first line starts with a byte order mark.　Then an ideographic space,\x1cand a "
    "file separator.",
    "Students who read every day improve there vocabulary. They also learn how to spell words "
    "correctly, wich helps them in all subjects.",
    "I think school uniforms is a good idea because everyone look the same and nobody feel bad "
    "about their clothes.",
    "the the the cat the dog the the bird sat sat on on the mat mat the the",
    "Short.",
    "",
]

EXTRA = ["subject", "experiments", "whole", "useful", "their", "which", "information", "the", "a",
         "very", "students", "Their", "dont", "don't", "Istanbul", "cafe", "café",
         "Straße", "strasse", "οδος", "we", "mat", "sat", "on"]

EDGE = ["", "   ", '""', "“”", "...", "!!", "﻿", "\x1c", "　word　", "_",
        "__init__", "2019", "3.50", "²", "Ⅰ chapter", "'", "``", "« »"]

OPEN_CLOSE = [('"', '"'), ("“", "”"), ("‘", "’"), ("'", "'"),
              ("«", "»"), ("`", "`"), ("„", "“")]
PAD = [" ", "\t", "\n", "　", "\x1c", "﻿", " ", ""]

KINDS = ["slice", "joined", "case", "nopunct", "drop", "insert", "swap", "replace", "multi",
         "nfd", "edge", "random"]
THRESHOLDS = [0.6, 0.6, 0.6, 0.0, 0.3, 0.5, 0.75, 0.9, 1.0]


def _edit(rng: random.Random, span: list[str], kind: str) -> None:
    if kind == "drop" and len(span) > 1:
        del span[rng.randrange(len(span))]
    elif kind == "insert":
        span.insert(rng.randint(0, len(span)), rng.choice(EXTRA))
    elif kind == "swap" and len(span) > 1:
        i = rng.randrange(len(span) - 1)
        span[i], span[i + 1] = span[i + 1], span[i]
    elif kind == "replace" and span:
        span[rng.randrange(len(span))] = rng.choice(EXTRA)


def make_quote(rng: random.Random, src: str) -> tuple[str, str]:
    toks = src.split()
    kind = rng.choice(KINDS)
    if kind == "edge":
        return kind, rng.choice(EDGE)
    if kind == "random" or not toks:
        return "random", " ".join(rng.choice(EXTRA) for _ in range(rng.randint(0, 8)))
    if kind == "slice":
        a = rng.randrange(len(src))
        b = rng.randint(a, min(len(src), a + 120))
        q = src[a:b]
    else:
        s = rng.randrange(len(toks))
        span = toks[s : s + rng.randint(1, min(14, len(toks) - s))]
        if kind == "case":
            span = [w.lower() if rng.random() < 0.5 else w.upper() for w in span]
        elif kind == "nopunct":
            span = ["".join(c for c in w if c.isalnum()) for w in span]
        elif kind == "multi":
            for _ in range(rng.randint(2, 4)):
                _edit(rng, span, rng.choice(["drop", "insert", "swap", "replace"]))
        elif kind in ("drop", "insert", "swap", "replace"):
            _edit(rng, span, kind)
        q = " ".join(span)
        if kind == "nfd":
            q = unicodedata.normalize("NFD", q)
    if rng.random() < 0.4:
        o, c = rng.choice(OPEN_CLOSE)
        q = rng.choice(PAD) + o + q + c + rng.choice(PAD)
    return kind, q


def build(seed: str, per_source: int) -> dict:
    rng = random.Random(seed)
    cases = []
    for i, src in enumerate(SOURCES):
        for _ in range(per_source):
            kind, quote = make_quote(rng, src)
            threshold = rng.choice(THRESHOLDS)
            r = vqc.check(src, quote, altered_threshold=threshold)
            cases.append({
                "source": i, "kind": kind, "quote": quote, "threshold": threshold,
                "category": r.category, "similarity": r.similarity,
                "quote_words": vqc.words(vqc.clean_quote(quote)),
            })
    by_category: dict[str, int] = {}
    for c in cases:
        by_category[c["category"]] = by_category.get(c["category"], 0) + 1
    return {
        "reference": "verbatim_quote_check.py, feedback-commons tools/, tag v0.8.0",
        "python": sys.version.split()[0],
        "unicode": unicodedata.unidata_version,
        "seed": seed,
        "sources": SOURCES,
        "source_words": [vqc.words(s) for s in SOURCES],
        "by_category": by_category,
        "cases": cases,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-source", type=int, default=320)
    ap.add_argument("--seed", default="qcheck-parity-v1")
    args = ap.parse_args(argv)
    data = build(args.seed, args.per_source)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    print(json.dumps({"cases": len(data["cases"]), "by_category": data["by_category"],
                      "python": data["python"], "unicode": data["unicode"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
