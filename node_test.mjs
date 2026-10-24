// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Unit tests for the parts of quote-check.html that have no Python counterpart: finding quoted
// passages in feedback, one-quote-per-line mode, and the "what the student actually wrote" span.
// Made with AI agents working in MV2's name.
//
//   node node_test.mjs quote-check.html
import assert from "node:assert/strict";
import { loadCore } from "./parity.mjs";

const QC = loadCore(process.argv[2] || "quote-check.html");
const plain = (x) => JSON.parse(JSON.stringify(x)); // arrays from the vm realm -> this realm
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok - " + name);
}

test("finds straight, curly, guillemet and low-high double quotes; skips single quotes", () => {
  const fb = 'You wrote “my favorite subjet” and "hole year". Also «hola» and ' +
    "„Straße“ but not 'single' or don't.";
  assert.deepEqual(plain(QC.extractQuotes(fb)), ["my favorite subjet", "hole year", "hola", "Straße"]);
});

test("empty or blank quoted passages are skipped", () => {
  assert.deepEqual(plain(QC.extractQuotes('An empty "" and a blank “  ” and "x".')), ["x"]);
  assert.deepEqual(plain(QC.extractQuotes("no quotes here")), []);
});

test("one quote per line drops blank lines and handles CRLF", () => {
  assert.deepEqual(plain(QC.quoteLines("a\n\n  \nb\r\nc\r")), ["a", "b", "c"]);
});

test("exact, same words, changed words, not found", () => {
  const src = "The cat sat on the mat.";
  assert.equal(QC.check(src, "cat sat on").category, QC.EXACT);
  assert.equal(QC.check(src, '"Cat sat on the mat"').category, QC.PUNCT_WHITESPACE);
  assert.equal(QC.check(src, "the dog sat on the mat").category, QC.ALTERED);
  assert.equal(QC.check(src, "completely different words here").category, QC.NOT_FOUND);
  assert.equal(QC.check(src, "").category, QC.NOT_FOUND);
  assert.equal(QC.check(src, '""').category, QC.NOT_FOUND);
});

test("a silently corrected misspelling is shown with the student's own words", () => {
  const src = "Last year it was the best day of the hole year! We went home.";
  const r = QC.check(src, "it was the best day of the whole year");
  assert.equal(r.category, QC.ALTERED);
  assert.ok(r.similarity >= 0.6 && r.similarity < 1);
  assert.equal(typeof r.studentWrote, "string");
  assert.ok(src.includes(r.studentWrote), r.studentWrote);
  assert.ok(r.studentWrote.includes("hole"), r.studentWrote);
});

test("student span keeps the original letters and accents (NFC)", () => {
  const src = "The café near my house opened in 2019.";
  const r = QC.check(src, "the café next to my house opened");
  assert.equal(r.category, QC.ALTERED);
  assert.ok(r.studentWrote.normalize("NFC").includes("café"), r.studentWrote);
});

test("threshold 0 with no shared word is 'altered' at similarity 0 and no span (as in Python)", () => {
  const r = QC.check("alpha beta gamma", "delta", 0);
  assert.equal(r.category, QC.ALTERED);
  assert.equal(r.similarity, 0);
  assert.equal(r.studentWrote, null);
  const e = QC.check("", "word", 0);
  assert.equal(e.category, QC.ALTERED);
  assert.equal(e.studentWrote, null);
});

test("strip follows Python: BOM is not whitespace, U+001C and U+3000 are", () => {
  assert.equal(QC.cleanQuote("　“word”\u001c"), "word");
  assert.equal(QC.cleanQuote("﻿word"), "﻿word");
});

console.log(`${passed} tests passed`);
