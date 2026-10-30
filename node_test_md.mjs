// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Unit tests for the Markdown-aware reading in quote-check.html (script id="qc-md"), on short
// made-up sentences: each formatting step, ellipses, marked and unmarked changes, and the page's
// rule that a match inside a longer word is not "same words". md_parity.mjs checks the same code
// against the Python reference (explain.py) on many generated cases.
// Made with AI agents working in MV2's name.
//
//   node node_test_md.mjs quote-check.html
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

export function loadCoreAndMd(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const ctx = vm.createContext({});
  for (const id of ["qc-core", "qc-md"]) {
    const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
    if (!m) throw new Error("no <script id=\"" + id + "\"> block in " + htmlPath);
    vm.runInContext(m[1], ctx, { filename: id });
  }
  if (!ctx.QC || !ctx.QM) throw new Error("qc-core or qc-md did not define QC / QM");
  return { QC: ctx.QC, QM: ctx.QM };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const { QM } = loadCoreAndMd(process.argv[2] || "quote-check.html");
  const plain = (x) => JSON.parse(JSON.stringify(x)); // arrays from the vm realm -> this realm
  let passed = 0;
  const test = (name, fn) => {
    fn();
    passed++;
    console.log("ok - " + name);
  };
  const SRC = "The cat sat on the mat, and the dog slept by the door.";
  const v = (src, q) => plain(QM.verdict(src, q, 0.6));

  test("exact", () => {
    const r = v(SRC, "cat sat on the mat");
    assert.equal(r.verdict, "exact");
    assert.equal(r.cls, "exact");
    assert.equal(r.why, "");
  });

  test("bold or italics, with * or _", () => {
    for (const q of ["**cat** sat on the", "__cat__ sat on the", "*cat* sat on the"]) {
      const r = v(SRC, q);
      assert.equal(r.cls, "emphasis", q);
      assert.equal(r.verdict, "same_words", q);
      assert.equal(r.why, "emphasis", q);
    }
  });

  test("curly apostrophe", () => {
    const r = v("I fed the dog's bowl twice.", "the dog’s bowl twice");
    assert.equal(r.cls, "typography");
    assert.equal(r.verdict, "same_words");
  });

  test("spacing before a comma", () => {
    const r = v(SRC, "the mat , and the dog");
    assert.equal(r.cls, "spacing");
    assert.equal(r.verdict, "same_words");
  });

  test("punctuation at the quote's ends", () => {
    for (const q of ["sat on the mat.", "(sat on the mat)", "...sat on the mat", "sat on the mat;"]) {
      const r = v(SRC, q);
      assert.equal(r.cls, "edges", q);
      assert.equal(r.verdict, "same_words", q);
      assert.equal(r.why, "edges", q);
    }
  });

  test("capital letters", () => {
    const r = v(SRC, "The Dog slept");
    assert.equal(r.cls, "case");
    assert.equal(r.verdict, "same_words");
  });

  test("an ellipsis inside the quote is words left out", () => {
    for (const q of ["the cat sat ... by the door", "the cat sat [...] by the door",
                     "the cat sat … by the door", "the cat sat . . . by the door"]) {
      const r = v(SRC, q);
      assert.equal(r.cls, "elision", q);
      assert.equal(r.verdict, "left_out", q);
      assert.equal(r.why, "elision", q);
    }
  });

  test("words left out, pieces found only word by word", () => {
    const r = v("I love cats, and I also like dogs.", "love, cats ... like dogs");
    assert.equal(r.cls, "elision_words");
    assert.equal(r.verdict, "left_out");
  });

  test("an ellipsis whose pieces are out of order is not words left out", () => {
    const r = v(SRC, "by the door ... the cat sat");
    assert.notEqual(r.verdict, "left_out");
  });

  test("other punctuation inside the quote", () => {
    const r = v("It is a well known idea.", "a well-known idea");
    assert.equal(r.cls, "other_punctuation");
    assert.equal(r.verdict, "same_words");
    assert.equal(r.why, "other_punctuation");
  });

  test("changed words, marked and unmarked", () => {
    const marked = v(SRC, "the cat **sits** on the mat");
    assert.equal(marked.cls, "word_changed");
    assert.equal(marked.verdict, "marked");
    assert.equal(marked.why, "marked");
    const unmarked = v(SRC, "the cat sits on the mat");
    assert.equal(unmarked.verdict, "altered");
    assert.equal(unmarked.why, "");
    assert.equal(unmarked.check.studentWrote, "The cat sat on the mat");
  });

  test("not found", () => {
    assert.equal(v(SRC, "completely unrelated words here").verdict, "not_found");
    assert.equal(v(SRC, "**totally** unrelated words here").verdict, "not_found");
  });

  test("a match inside a longer word is not same words (stricter than explain.py)", () => {
    const r = v("Then she went to school today.", "he went to school.");
    assert.equal(r.cls, "edges");
    assert.equal(r.verdict, "altered");
    const e = v("Then she went to school today.", "he went ... today");
    assert.equal(e.cls, "elision");
    assert.notEqual(e.verdict, "left_out");
  });

  test("capitals are folded like Python's casefold for sharp s", () => {
    assert.equal(QM.casefold("STRASSE Straße ẞ"), "strasse strasse ss");
    const r = v("Die Straße ist lang.", "DIE STRASSE IST LANG.");
    assert.equal(r.cls, "case");
  });

  test("spacing rule", () => {
    assert.equal(QM.spacing("a  ,b ( c ) d;e"), "a, b (c) d; e");
    assert.equal(QM.spacing("1,000 and 2;3"), "1,000 and 2;3");
    assert.equal(QM.spacing("  wait !  \n ok"), "wait! ok");
  });

  test("fragments between ellipses", () => {
    assert.deepEqual(plain(QM.fragments("a b [...] c d . . . e …f")), ["a b", "c d", "e", "f"]);
    assert.deepEqual(plain(QM.fragments("...a b...")), ["a b"]);
    assert.deepEqual(plain(QM.fragments("a.. b")), ["a.. b"]);
  });

  test("words in order", () => {
    const src = ["i", "love", "cats", "and", "dogs"];
    assert.equal(QM.wordsInOrder([["love", "cats"], ["dogs"]], src), true);
    assert.equal(QM.wordsInOrder([["dogs"], ["love"]], src), false);
    assert.equal(QM.wordsInOrder([["cats", "and"], ["and"]], src), false);
    assert.equal(QM.wordsInOrder([], src), false);
  });

  console.log(`${passed} tests passed`);
}
