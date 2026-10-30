// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Unit tests for the English/Spanish interface text of quote-check.html (script id="qc-text"):
// both languages have the same keys and placeholders, every text the page marks for translation
// exists, the English summary line is exactly v0.1.0's, the Markdown-aware summary adds up, and
// the browser-language pick works.
// Made with AI agents working in MV2's name.
//
//   node node_test_i18n.mjs quote-check.html
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const htmlPath = process.argv[2] || "quote-check.html";
const html = fs.readFileSync(htmlPath, "utf8");
const block = html.match(/<script id="qc-text">([\s\S]*?)<\/script>/);
assert.ok(block, "no qc-text block");
const ctx = vm.createContext({});
vm.runInContext(block[1], ctx, { filename: "qc-text" });
const QT = ctx.QT;
assert.ok(QT, "qc-text did not define QT");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok - " + name);
}

const holes = (s) => (s.match(/\{\w+\}/g) || []).sort();
const en = QT.STRINGS.en;
const es = QT.STRINGS.es;

test("English and Spanish have the same keys and the same {placeholders}", () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const k of Object.keys(en)) {
    assert.equal(typeof en[k], "string", k);
    assert.ok(es[k].length > 0, k);
    assert.deepEqual(holes(es[k]), holes(en[k]), k);
  }
});

test("every data-i18n and data-i18n-ph key on the page has text", () => {
  const keys = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 22, String(keys.length));
  for (const k of keys) assert.ok(Object.prototype.hasOwnProperty.call(en, k), k);
});

test("the page's built-in English text is the English table's text (works without the switch)", () => {
  const els = [...html.matchAll(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)</g)];
  assert.ok(els.length >= 20, String(els.length));
  const squash = (s) => s.replace(/\s+/g, " ").trim();
  for (const [, , k, text] of els) assert.equal(squash(text), en[k], k);
});

test("verdict labels exist for all six verdicts", () => {
  for (const k of ["v_exact", "v_punct", "v_left_out", "v_marked", "v_altered", "v_not_found"]) {
    assert.ok(en[k] && es[k] && en[k] !== es[k], k);
  }
});

test("every reason the Markdown-aware mode can give has text", () => {
  for (const k of ["emphasis", "typography", "spacing", "edges", "case", "elision",
                   "other_punctuation", "marked"]) {
    assert.ok(en["why_" + k] && es["why_" + k] && en["why_" + k] !== es["why_" + k], k);
  }
  assert.ok(en.th_why && es.th_why);
});

test("English summary is exactly v0.1.0's line", () => {
  const four = { exact: 1, punctuation_or_whitespace: 1, altered: 1, not_found: 1 };
  assert.equal(QT.summary("en", four),
    "4 quotes checked: 2 keep the student's words (1 exact, 1 same words), 1 changed words, 1 not found.");
  const one = { exact: 1, punctuation_or_whitespace: 0, altered: 0, not_found: 0 };
  assert.equal(QT.summary("en", one),
    "1 quote checked: 1 keep the student's words (1 exact, 0 same words), 0 changed words, 0 not found.");
});

test("Spanish summary", () => {
  const four = { exact: 1, punctuation_or_whitespace: 1, altered: 1, not_found: 1 };
  assert.equal(QT.summary("es", four),
    "4 citas revisadas. Con las palabras del estudiante: 2 (exactas: 1; mismas palabras: 1). " +
    "Con palabras cambiadas: 1. No encontradas: 1.");
  const one = { exact: 0, punctuation_or_whitespace: 0, altered: 0, not_found: 1 };
  assert.ok(QT.summary("es", one).startsWith("1 cita revisada."));
  assert.ok(!/\{\w+\}/.test(QT.summary("es", one)));
});

test("Markdown-aware summary, English and Spanish", () => {
  const six = { exact: 1, same_words: 2, left_out: 1, marked: 1, altered: 2, not_found: 0 };
  assert.equal(QT.summaryMd("en", six),
    "7 quotes checked: 4 keep the student's words (1 exact, 2 same words, 1 with words left out), " +
    "1 changed words marked in bold or italics, 2 changed words not marked, 0 not found.");
  assert.equal(QT.summaryMd("es", six),
    "7 citas revisadas. Con las palabras del estudiante: 4 (exactas: 1; mismas palabras: 2; " +
    "con palabras omitidas: 1). Con palabras cambiadas y marcadas en negrita o cursiva: 1. " +
    "Con palabras cambiadas sin marcar: 2. No encontradas: 0.");
  const one = { exact: 0, same_words: 0, left_out: 1, marked: 0, altered: 0, not_found: 0 };
  assert.ok(QT.summaryMd("en", one).startsWith("1 quote checked: 1 keep"));
  assert.ok(QT.summaryMd("es", one).startsWith("1 cita revisada."));
  assert.ok(!/\{\w+\}/.test(QT.summaryMd("es", one)));
});

test("browser language pick", () => {
  assert.equal(QT.pick(["es-MX", "en-US"]), "es");
  assert.equal(QT.pick(["fr-FR", "es"]), "es");
  assert.equal(QT.pick(["EN-gb", "es"]), "en");
  assert.equal(QT.pick(["fr", "de"]), "en");
  assert.equal(QT.pick([]), "en");
  assert.equal(QT.pick(undefined), "en");
  assert.equal(QT.pick([undefined, null, "es"]), "es");
  assert.equal(QT.pick(["constructor", "__proto__"]), "en");
});

test("unknown language or key falls back to English", () => {
  assert.equal(QT.t("fr", "run"), en.run);
  assert.equal(QT.t("es", "run"), es.run);
  assert.equal(QT.t("es", "no_such_key"), undefined);
});

test("no interface text could be read as markup or reach the network", () => {
  for (const table of [en, es]) {
    for (const [k, s] of Object.entries(table)) {
      assert.ok(!/[<>]/.test(s), k);
      assert.ok(!/https?:/.test(s), k);
    }
  }
});

console.log(`${passed} tests passed`);
