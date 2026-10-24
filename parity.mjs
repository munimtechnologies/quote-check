// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Parity check: the JavaScript port in quote-check.html (script id="qc-core") must give the
// same category, similarity (bit for bit) and word tokens as the Python reference on every
// case make_cases.py wrote. Made with AI agents working in MV2's name.
//
//   node parity.mjs quote-check.html cases.json [report.json]
import fs from "node:fs";
import vm from "node:vm";

export function loadCore(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const m = html.match(/<script id="qc-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no <script id=\"qc-core\"> block in " + htmlPath);
  const ctx = vm.createContext({});
  vm.runInContext(m[1], ctx, { filename: "qc-core" });
  if (!ctx.QC) throw new Error("qc-core did not define QC");
  return ctx.QC;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function main() {
  const [htmlPath, casesPath, reportPath] = process.argv.slice(2);
  const QC = loadCore(htmlPath);
  const data = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const mismatches = [];
  data.sources.forEach((s, i) => {
    const js = QC.words(s);
    if (!same(js, data.source_words[i])) mismatches.push({ what: "source_words", source: i, js, py: data.source_words[i] });
  });
  const byCategory = {};
  const byKind = {};
  let alteredWithoutSpan = 0;
  for (const [n, c] of data.cases.entries()) {
    const src = data.sources[c.source];
    const r = QC.check(src, c.quote, c.threshold);
    const qw = QC.words(QC.cleanQuote(c.quote));
    if (r.category !== c.category || r.similarity !== c.similarity || !same(qw, c.quote_words)) {
      mismatches.push({ what: "case", n, source: c.source, kind: c.kind, quote: c.quote, threshold: c.threshold,
        js: { category: r.category, similarity: r.similarity, words: qw },
        py: { category: c.category, similarity: c.similarity, words: c.quote_words } });
    }
    if (r.category === QC.ALTERED && r.similarity > 0 && (typeof r.studentWrote !== "string" || !r.studentWrote)) {
      alteredWithoutSpan++;
    }
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  }
  const missing = [QC.EXACT, QC.PUNCT_WHITESPACE, QC.ALTERED, QC.NOT_FOUND].filter((k) => !byCategory[k]);
  const report = {
    node: process.version,
    reference: data.reference, python: data.python, python_unicode: data.unicode,
    cases: data.cases.length, sources: data.sources.length,
    by_category: byCategory, by_kind: byKind,
    mismatches: mismatches.length, altered_without_span: alteredWithoutSpan,
    categories_never_exercised: missing,
    ok: mismatches.length === 0 && alteredWithoutSpan === 0 && missing.length === 0,
  };
  console.log(JSON.stringify(report));
  for (const m of mismatches.slice(0, 25)) console.log(JSON.stringify(m));
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify({ report, first_mismatches: mismatches.slice(0, 200) }, null, 1));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("parity.mjs")) main();
