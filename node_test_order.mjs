// Copyright 2026 Munim, Inc. Licensed under the Apache License, Version 2.0 (Apache-2.0).
// Tests for v0.4.0's "Words" and "Where to look" columns and the "Changed quotes first" order:
// the helpers in qc-text (QT.differ, QT.look, QT.order) on made-up rows, and the page's own
// interface script run end to end on a small stand-in for the browser page, with the same made-up
// sentences as the release smoke tests. No real student text.
// Made with AI agents working in MV2's name.
//
//   node node_test_order.mjs quote-check.html
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const htmlPath = process.argv[2] || "quote-check.html";
const html = fs.readFileSync(htmlPath, "utf8");
function block(id) {
  const m = html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
  assert.ok(m, "no " + id + " block");
  return m[1];
}
const ui = html.match(/<script>\r?\n([\s\S]*?)<\/script>/);
assert.ok(ui, "no interface script");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok - " + name);
}

const textCtx = vm.createContext({});
vm.runInContext(block("qc-text"), textCtx, { filename: "qc-text" });
const QT = textCtx.QT;
const en = QT.STRINGS.en;
const es = QT.STRINGS.es;

test("differ counts the words that differ, a swapped word once", () => {
  assert.equal(QT.differ(["a", "b", "c"], ["a", "x", "c"]), 1);
  assert.equal(QT.differ(["a", "b"], ["a", "b", "c"]), 1);
  assert.equal(QT.differ(["a", "b", "c"], ["a", "c"]), 1);
  assert.equal(QT.differ(["a", "b", "c", "d"], ["d", "c", "b", "a"]), 3);
  assert.equal(QT.differ(["a", "b"], ["x", "y", "z"]), 3);
  assert.equal(QT.differ([], []), 0);
});

test("look: 1-2 differing words read as a close copy, 3 or more as a looser match", () => {
  assert.equal(QT.look("en", 0), "");
  assert.equal(QT.look("en", 1), en.look_close_one);
  assert.equal(QT.look("en", 2), "2 words differ from what the student wrote: compare word by word.");
  assert.ok(QT.look("en", 3).startsWith("3 words differ: compare with the whole passage"));
  assert.equal(QT.look("es", 1), es.look_close_one);
  assert.notEqual(es.look_close_one, en.look_close_one);
  for (const n of [2, 3, 7]) {
    const s = QT.look("es", n);
    assert.ok(s.startsWith(String(n) + " palabras difieren") && !/\{\w+\}/.test(s), s);
  }
});

test("order: unmarked changes (fewest differing words, then fewest words), marked, not found, the rest", () => {
  const rows = [
    { n: 1, verdict: "exact", words: 3, differ: 0 },
    { n: 2, verdict: "altered", words: 8, differ: 3 },
    { n: 3, verdict: "not_found", words: 5, differ: 0 },
    { n: 4, verdict: "altered", words: 5, differ: 1 },
    { n: 5, verdict: "marked", words: 4, differ: 1 },
    { n: 6, verdict: "altered", words: 4, differ: 1 },
    { n: 7, verdict: "punctuation_or_whitespace", words: 6, differ: 0 },
    { n: 8, verdict: "left_out", words: 9, differ: 0 }
  ];
  const before = JSON.stringify(rows);
  assert.equal(QT.order(rows).map((r) => r.n).join(","), "6,4,2,5,3,1,7,8");
  assert.equal(JSON.stringify(rows), before, "the input is left as it was");
  assert.equal(QT.order([]).length, 0);
});

// Just enough of a browser page for the interface script: elements by id, created elements with
// children and text, click and change handlers.
class El {
  constructor(tag, props) {
    this.tag = tag;
    this.children = [];
    this.own = "";
    this.handlers = {};
    Object.assign(this, props || {});
  }
  get textContent() {
    return this.own + this.children.map((c) => c.textContent).join("");
  }
  set textContent(s) {
    this.own = String(s);
    this.children = [];
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  addEventListener(ev, fn) {
    this.handlers[ev] = fn;
  }
}

function openPage({ source, feedback, md = true, order = false, lang = "en" }) {
  const els = {
    source: new El("textarea", { value: source }),
    feedback: new El("textarea", { value: feedback }),
    md: new El("input", { checked: md }),
    lines: new El("input", { checked: false }),
    order: new El("input", { checked: order }),
    threshold: new El("input", { value: "0.6" }),
    run: new El("button"),
    lang: new El("select", { value: lang }),
    out: new El("div")
  };
  const document = {
    documentElement: {},
    title: "",
    getElementById: (id) => {
      assert.ok(els[id], "unknown id " + id);
      return els[id];
    },
    createElement: (tag) => new El(tag),
    querySelectorAll: () => []
  };
  const ctx = vm.createContext({ document, navigator: { languages: [lang] } });
  for (const id of ["qc-core", "qc-md", "qc-text"]) vm.runInContext(block(id), ctx, { filename: id });
  vm.runInContext(ui[1], ctx, { filename: "interface" });
  els.run.handlers.click();
  const [p, table] = els.out.children;
  const rows = table.children.map((tr) => tr.children.map((td) => td.textContent));
  return { summary: p.textContent, head: rows[0], rows: rows.slice(1), els };
}

const SRC = "The cat sat on the mat, and the dog slept by the door.";
const FB = 'You wrote "cat sat on the mat" and "the cat sat ... by the door". "**cat** sat on the" is fine, ' +
  'but "the cat **sits** on the mat" and "the cat sits on the mat" change a word. ' +
  '"completely unrelated words here" is not in it.';
const SUMMARY_MD = "6 quotes checked: 3 keep the student's words (1 exact, 1 same words, 1 with words left out), " +
  "1 changed words marked in bold or italics, 1 changed words not marked, 1 not found.";
const col = (rows, i) => rows.map((r) => r[i]);

test("Markdown-aware page: Words and Where to look columns, in the feedback's order", () => {
  const r = openPage({ source: SRC, feedback: FB });
  assert.deepEqual(r.head, ["#", "Quote in the feedback", "Words", "Verdict", "Why not exact", "Similarity",
    "Where to look", "What the student actually wrote"]);
  assert.deepEqual(col(r.rows, 0), ["1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(col(r.rows, 2), ["5", "6", "4", "6", "6", "4"]);
  assert.deepEqual(col(r.rows, 3), ["Exact", "Same words, some left out", "Same words", "Changed words, marked",
    "Changed words", "Not found"]);
  assert.deepEqual(col(r.rows, 6), ["", "", "", en.look_close_one, en.look_close_one, ""]);
  assert.equal(r.rows[3][5], "0.833");
  assert.equal(r.rows[4][7], "The cat sat on the mat");
  assert.equal(r.summary, SUMMARY_MD);
});

test("Changed quotes first: unmarked change, marked change, not found, the rest; # keeps the number", () => {
  const r = openPage({ source: SRC, feedback: FB, order: true });
  assert.deepEqual(col(r.rows, 0), ["5", "4", "6", "1", "2", "3"]);
  assert.deepEqual(col(r.rows, 3).slice(0, 3), ["Changed words", "Changed words, marked", "Not found"]);
  assert.equal(r.summary, SUMMARY_MD, "the summary does not depend on the order");
});

test("the order box redoes the table when changed", () => {
  const r = openPage({ source: SRC, feedback: FB });
  r.els.order.checked = true;
  r.els.order.handlers.change();
  const table = r.els.out.children[1];
  assert.equal(table.children[1].children[0].textContent, "5");
});

test("plain mode keeps v0.2.0's verdicts and summary and adds the two columns", () => {
  const r = openPage({ source: SRC, feedback: FB, md: false });
  assert.deepEqual(r.head, ["#", "Quote in the feedback", "Words", "Verdict", "Similarity", "Where to look",
    "What the student actually wrote"]);
  assert.deepEqual(col(r.rows, 3), ["Exact", "Changed words", "Same words", "Changed words", "Changed words",
    "Not found"]);
  assert.equal(r.rows[1][4], "0.727");
  assert.deepEqual(col(r.rows, 5), ["", "2 words differ from what the student wrote: compare word by word.", "",
    en.look_close_one, en.look_close_one, ""]);
  assert.equal(r.summary,
    "6 quotes checked: 2 keep the student's words (1 exact, 1 same words), 3 changed words, 1 not found.");
});

test("a loosely matched quote gets the whole-passage hint", () => {
  const r = openPage({ source: SRC, feedback: 'You said "the dog was sleeping near the door".' });
  assert.equal(r.rows.length, 1);
  const [n, quote, words, verdict, why, sim, hint, wrote] = r.rows[0];
  assert.deepEqual([n, quote, words, verdict, why, sim], ["1", "the dog was sleeping near the door", "7",
    "Changed words", "", "0.615"]);
  assert.equal(wrote, "the dog slept by the door");
  assert.equal(hint, QT.look("en", 3));
});

test("Spanish page", () => {
  const r = openPage({ source: SRC, feedback: FB, lang: "es" });
  assert.equal(r.head[2], "Palabras");
  assert.equal(r.head[6], "Qué revisar");
  assert.equal(r.rows[4][6], es.look_close_one);
  assert.ok(r.summary.startsWith("6 citas revisadas."));
});

console.log(`${passed} tests passed`);
