// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Parity of the page's Markdown-aware reading (script id="qc-md") with the Python reference
// (explain.py from feedback-quote-audit, audit 1b): for every case made by make_md_cases.py, the
// class, the elided and emphasis flags, the base category and the page's verdict must match.
// Exits 1 on any mismatch. Made with AI agents working in MV2's name.
//
//   node md_parity.mjs quote-check.html cases-md.json [report.json]
import fs from "node:fs";
import { loadCoreAndMd } from "./node_test_md.mjs";

const [htmlPath, casesPath, reportPath] = process.argv.slice(2);
const { QM } = loadCoreAndMd(htmlPath || "quote-check.html");
const data = JSON.parse(fs.readFileSync(casesPath || "cases-md.json", "utf8"));
const FIELDS = ["cls", "elided", "emphasis", "category", "verdict"];

const mismatches = [];
const byClass = {};
const byVerdict = {};
for (let i = 0; i < data.cases.length; i++) {
  const c = data.cases[i];
  const e = QM.explain(c.source, c.quote, c.threshold);
  const v = QM.verdict(c.source, c.quote, c.threshold);
  const got = { cls: e.cls, elided: e.elided, emphasis: e.emphasis, category: e.check.category,
                verdict: v.verdict };
  const bad = FIELDS.filter((f) => got[f] !== c.expect[f]);
  if (bad.length) mismatches.push({ case: i, fields: bad, got, expect: c.expect, quote: c.quote });
  byClass[got.cls] = (byClass[got.cls] || 0) + 1;
  byVerdict[got.verdict] = (byVerdict[got.verdict] || 0) + 1;
}

const report = {
  cases: data.cases.length,
  mismatches: mismatches.length,
  first_mismatches: mismatches.slice(0, 25),
  by_class: byClass,
  by_verdict: byVerdict,
  python: data.python,
  python_unicode: data.unicode,
  node: process.version,
  node_unicode: process.versions.unicode,
  seed: data.seed,
};
const text = JSON.stringify(report, null, 1);
if (reportPath) fs.writeFileSync(reportPath, text);
console.log(text);
process.exit(mismatches.length ? 1 : 0);
