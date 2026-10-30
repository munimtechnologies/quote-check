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
"""Seeded synthetic cases for the Markdown-aware parity test, with answers from the Python reference.

Each case is a made-up source text, a quote cut from it and then changed by 0-3 random edits
(Markdown emphasis, curly quotes, spacing, punctuation at the ends, capitals, an ellipsis, a
hyphen, a changed, dropped or added word), and a threshold. The expected answer comes from
feedback-quote-audit's explain.py (audit 1b) on top of verbatim_quote_check.py, both fetched at
pinned versions by setup.sh. md_parity.mjs then runs the page's qc-md block on every case.
No real student text is used. Made with AI agents working in MV2's name.

    python make_md_cases.py --out cases-md.json [--n 4000]
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import unicodedata

import explain
import verbatim_quote_check as vqc

SEED = "quote-check-v0.3.0-md-parity"
THRESHOLDS = (0.0, 0.3, 0.6, 0.6, 0.6, 0.75, 0.9, 1.0)
# Every class explain.py can give, and every verdict the page can show, must be exercised.
CLASSES = explain.CLASSES
VERDICTS = ("exact", "same_words", "left_out", "marked", "altered", "not_found")
MIN_EACH = 20

SOURCES = [
    "In my opinion, the goverment should invest more money in public transport, because it "
    "reduces traffic and pollution. However, some people think that cars are more convenient.",
    "Last summer I went to the beach with my family. It was the best day of the hole year: we "
    "swam, we ate ice cream, and my little brother (who is five) built a huge sand castle!",
    "Technology has changed the way students learn; for example, online courses let them study "
    "at their own pace. On the other hand, they can feel isolated - and lose motivation.",
    "Many people believe that “homework is useless”, but I don't agree. It helps "
    "students to practise what they learnt in class — and to become more independent.",
    "En mi opinión, el gobierno debería invertir más dinero en la educación "
    "pública. Sin embargo, algunas personas piensan que no es necesario; ¿quién "
    "tiene razón?",
    "The number of tourists rose from 1,000 to 2,500 in ten years. This is a big change, and "
    "it has both advantages and disadvantages for the local people.",
    "Die Straße ist sehr lang, und die Häuser sind alt. Wir wohnen dort seit 2010.",
    "Ο δρόμος είναι μακρύς "
    "και ο καιρός καλός. "
    "Ο δάσκαλος είπε ότι "
    "η εργασία ήταν καλή.",
    "Kızım okula gidiyor ve İstanbul'da yaşıyor. Bu şehir çok "
    "büyük ama çok güzel.",
    "Some people say [that] studying abroad is expensive... But I think it is worth it, "
    "because you learn a new language and meet people from other cultures.",
    "Children should learn to cook at school.  It is a useful skill , and it teaches them "
    "about healthy food.\nParents agree with this idea.",
    "Firstly, well-known companies often pay higher salaries. Secondly, they offer training; "
    "thirdly, they look good on a CV!",
]
VOCAB = ["very", "really", "important", "government", "students", "not", "never", "good", "bad",
         "people", "money", "school", "however", "year", "whole", "believe", "think", "always",
         "gobierno", "educación", "straße", "ok", "change", "help"]
ELLIPSES = (" ... ", "...", " [...] ", " … ", "…", " . . . ", " […] ")
EDGE_ADD = (".", ",", "!", "?", ";", ":", "...", "…", ")", "'")
SPACES = ("  ", "\n", " ", " ", "　", "\t", "\u001c", "﻿")


def _tokens(text: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]


def _cut(rng: random.Random, source: str) -> str:
    toks = _tokens(source)
    n = rng.randint(1, min(14, len(toks)))
    i = rng.randint(0, len(toks) - n)
    return source[toks[i][0]:toks[i + n - 1][1]]


def _words(q: str) -> list[str]:
    return q.split(" ")


def t_emphasis(rng, q):
    w = _words(q)
    i = rng.randrange(len(w))
    mark = rng.choice(("**", "__", "*", "***"))
    if rng.random() < 0.3:
        return mark + q + mark
    w[i] = mark + w[i] + mark
    return " ".join(w)


def t_typography(rng, q):
    table = {"'": "’", '"': "“", "-": "–", "...": "…", ",": ","}
    out = q
    for a, b in table.items():
        if rng.random() < 0.7:
            out = out.replace(a, b)
    if out == q:
        out = q.replace(" ", " — ", 1) if rng.random() < 0.3 else "“" + q + "”"
    return out


def t_spacing(rng, q):
    r = rng.random()
    if r < 0.35:
        return re.sub(r"([,.;:!?])", r" \1", q, count=1)
    if r < 0.6:
        return q.replace(" ", rng.choice(SPACES), 1)
    if r < 0.8:
        return re.sub(r"([,;:!?]) ", r"\1", q, count=1)
    return " " + q + " "


def t_edges(rng, q):
    r = rng.random()
    if r < 0.3:
        return q.rstrip(".,;:!?)")
    if r < 0.6:
        return q + rng.choice(EDGE_ADD)
    if r < 0.8:
        return rng.choice(("...", "(", "…", "-", "'")) + q
    return "(" + q + ")"


def t_case(rng, q):
    r = rng.random()
    if r < 0.4:
        return q[:1].upper() + q[1:]
    if r < 0.7:
        return q.upper()
    if r < 0.9:
        return q.lower()
    return q.swapcase()


def t_elide(rng, q):
    w = _words(q)
    if len(w) < 3:
        return q + rng.choice(ELLIPSES) + rng.choice(VOCAB)
    i = rng.randint(1, len(w) - 2)
    j = rng.randint(i + 1, len(w) - 1)
    return " ".join(w[:i]) + rng.choice(ELLIPSES) + " ".join(w[j:])


def t_reorder(rng, q):
    w = _words(q)
    if len(w) < 4:
        return q
    k = len(w) // 2
    return " ".join(w[k:]) + rng.choice(ELLIPSES) + " ".join(w[:k])


def t_elide_punct(rng, q):
    """An ellipsis plus a comma inside the first piece: the words stay in order, the text does not."""
    w = _words(q)
    if len(w) < 4:
        return q.replace(" ", ", ", 1) if " " in q else q
    return w[0] + ", " + w[1] + rng.choice(ELLIPSES) + " ".join(w[3:])


def t_hyphen(rng, q):
    return q.replace(" ", "-", 1) if " " in q else q + "-"


def t_change(rng, q):
    w = _words(q)
    i = rng.randrange(len(w))
    r = rng.random()
    if r < 0.3:
        w[i] = rng.choice(VOCAB)
    elif r < 0.5 and len(w) > 1:
        del w[i]
    elif r < 0.7:
        w.insert(i, rng.choice(VOCAB))
    elif r < 0.85 and len(w[i]) > 3:
        s = w[i]
        k = rng.randrange(len(s) - 1)
        w[i] = s[:k] + s[k + 1] + s[k] + s[k + 2:]
    else:
        w[i] = "**" + rng.choice(VOCAB) + "**"
    return " ".join(w)


def t_nfd(rng, q):
    return unicodedata.normalize("NFD", q)


def t_random(rng, q):
    return " ".join(rng.choice(VOCAB) for _ in range(rng.randint(1, 8)))


EDITS = [t_emphasis, t_typography, t_spacing, t_edges, t_case, t_elide, t_elide_punct, t_reorder,
         t_hyphen, t_change, t_nfd, t_random]
WEIGHTS = [10, 24, 8, 12, 6, 10, 4, 2, 3, 10, 1, 2]


def reference(source: str, quote: str, threshold: float) -> dict:
    """explain.py's answer for one quote, plus the page's verdict rule written in Python."""
    res = vqc.check(source, quote, threshold)
    eforms = explain.essay_forms(source)
    source_words = vqc.words(source)
    cls, elided, emphasis = explain.explain(quote, {"category": res.category}, eforms, source_words)
    plain = vqc.clean_quote(quote).translate(explain.TYPOGRAPHY)
    pieces = [w for w in (vqc.words(p) for p in explain.ELLIPSIS_RE.split(plain)) if w]
    if cls == "exact":
        verdict = "exact"
    elif res.category in (vqc.EXACT, vqc.PUNCT_WHITESPACE):
        verdict = "same_words"
    elif elided and explain.words_in_order(pieces, source_words):
        verdict = "left_out"
    elif res.category == vqc.NOT_FOUND:
        verdict = "not_found"
    else:
        verdict = "marked" if emphasis else "altered"
    return {"cls": cls, "elided": elided, "emphasis": emphasis, "category": res.category,
            "verdict": verdict}


def make(n: int, seed: str = SEED) -> list[dict]:
    rng = random.Random(seed)
    cases = []
    for k in range(n):
        source = SOURCES[k % len(SOURCES)]
        quote = _cut(rng, source)
        for edit in rng.choices(EDITS, WEIGHTS, k=rng.choice((0, 1, 1, 1, 2, 2, 3))):
            quote = edit(rng, quote)
        if not vqc.clean_quote(quote):
            quote = _cut(rng, source)
        threshold = rng.choice(THRESHOLDS)
        cases.append({"source": source, "quote": quote, "threshold": threshold,
                      "expect": reference(source, quote, threshold)})
    return cases


def coverage(cases: list[dict]) -> dict:
    by_cls = {c: 0 for c in CLASSES}
    by_verdict = {v: 0 for v in VERDICTS}
    for c in cases:
        by_cls[c["expect"]["cls"]] += 1
        by_verdict[c["expect"]["verdict"]] += 1
    return {"by_class": by_cls, "by_verdict": by_verdict}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--n", type=int, default=4000)
    args = ap.parse_args(argv)
    cases = make(args.n)
    cov = coverage(cases)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump({"seed": SEED, "python": sys.version.split()[0],
                   "unicode": unicodedata.unidata_version, "coverage": cov, "cases": cases}, fh)
    print(json.dumps({"cases": len(cases), **cov}))
    thin = [k for part in cov.values() for k, v in part.items() if v < MIN_EACH]
    if thin:
        print("too few cases for: " + ", ".join(thin), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
