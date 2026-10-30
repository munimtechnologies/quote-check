# Quote check (one offline page)

One HTML file a teacher can open in any browser to see whether AI writing feedback quoted a
student's words exactly, or quietly changed them. Paste the student's text and the feedback;
every passage the feedback puts in quotation marks is checked against the student's text.
The page can be shown in **English or Spanish** (Language / Idioma, top right).

**Open it in your browser:** https://rawcdn.githack.com/munimtechnologies/quote-check/v0.3.0/quote-check.html
(release v0.3.0 of this repository's `quote-check.html`, served as-is by the free raw.githack.com
CDN; the CDN only delivers the page, and the page itself sends nothing anywhere, see Privacy).
Earlier versions stay at the same address with `v0.2.0` or `v0.1.0` in place of `v0.3.0`.

By MV2 of Munim, Inc. Made with AI agents working in his name. Apache-2.0.

**En español:** una sola página que funciona sin conexión y comprueba si la retroalimentación de
escritura hecha con IA cita las palabras del estudiante tal como las escribió. Abra el enlace de
arriba y elija «Español» en «Language / Idioma» (se elige solo si el navegador está en español).
La traducción al español se hizo con IA y aún no la ha revisado un docente.

## What is new in v0.3.0: Markdown-aware mode (on by default)

AI feedback is usually written in Markdown, with **bold** and *italics*. It often puts a
full stop or comma inside the quotation marks, and it leaves words out with "...". MV2's audit of
50,742 quotes in GLM-4.7's published feedback on 8,946 IELTS essays
([feedback-quote-audit](https://github.com/munimtechnologies/feedback-quote-audit), RESULTS-1b.md)
found that only 37.7% were character-exact, but 95.7% kept the student's words once those habits
were set aside. Nearly half differed only in punctuation at the quote's two ends. The new mode
reads quotes the way that audit did:

- bold and italics (`**`, `*`, `__`), curly quotes and dashes, spacing around punctuation,
  punctuation or quote marks at the quote's two ends, and capital letters are set aside. A new
  column, **Why not exact**, says which of these made the difference;
- an ellipsis inside a quote ("...", "…", "[...]", ". . .") is read as words left out. If every
  piece is the student's own words, in order, the verdict is **Same words, some left out**.
  Quotes stitched together this way showed as "changed words" or "not found" before;
- a quote that changes words *and* shows bold or italics is labelled **Changed words, marked**,
  because the bold usually marks a correction the student is meant to see. **Changed words** now
  means changed and not marked, which is the case a teacher should read first. In the audit that
  was 2.8% of quotes.

Audit 2 (RESULTS-2.md in the same repository) found that changed words were most common in short
quotes of 4-6 words. Some of those are suggested phrasing rather than the student's words, so read
short changed quotes first.

Untick **Markdown-aware** to get exactly v0.2.0's four verdicts and summary line.

## Use

1. Open the link above, or download [`quote-check.html`](quote-check.html) (on its page, use
   "Download raw file") and open it in a browser by double-clicking. No install, no account.
2. Choose English or Español (the browser's language is picked by default).
3. Paste the student's text, then the AI feedback.
4. Press **Check quotes** (**Revisar citas**).

Passages in "double quotes", “curly quotes”, «guillemets» or „low-high quotes“ are checked.
Single quotation marks are not, because they double as apostrophes; for those, tick **Each line
of the box is one quote** and paste one quote per line.

| Verdict | Resultado | Meaning |
|---|---|---|
| Exact | Exacta | the quote appears character for character in the student's text |
| Same words | Mismas palabras | every word matches in order; only punctuation, spacing, capitals or (Markdown-aware) bold and italics differ |
| Same words, some left out | Mismas palabras, con omisiones | Markdown-aware only: words left out with an ellipsis; every piece is the student's words, in order |
| Changed words, marked | Palabras cambiadas, marcadas | Markdown-aware only: words changed, and the quote shows bold or italics |
| Changed words | Palabras cambiadas | close to a passage of the student's text, but words were added, dropped or changed; that passage is shown |
| Not found | No encontrada | no passage is close enough (word similarity below the threshold, default 0.6) |

To check many feedback replies at once (a JSONL file, one reply and its student text per line), use
the command-line `quote_batch.py` in
[feedback-commons `tools/`](https://github.com/munimtechnologies/feedback-commons/tree/main/tools),
which uses the same checker as this page.

## Privacy

Student text never leaves the computer. The page loads nothing and sends nothing: its
Content-Security-Policy is `default-src 'none'`, so the browser itself blocks every network
request, and `test_quote_check_html.py` checks that the file has no external scripts, styles,
images, frames, forms or network calls. It works with the network switched off. Opening it from
the CDN link means the CDN sees that the page was requested, never what you paste into it; the
downloaded file avoids even that. The language choice is not stored anywhere.

## Same answers as the Python tools

- The checking code (`<script id="qc-core">`) is a line-for-line JavaScript port of
  `verbatim_quote_check.py` ([feedback-commons `tools/`](https://github.com/munimtechnologies/feedback-commons/tree/main/tools),
  tag v0.8.0), including Python difflib's `SequenceMatcher.ratio`. It is unchanged since v0.1.0:
  `build_page.py` cuts it out of the released v0.1.0 page byte for byte, and a test confirms the
  two blocks are identical. Its parity check against the Python tool (about 4,160 seeded synthetic
  cases, 0 mismatches before v0.1.0 and v0.2.0) is run again on every build.
- The Markdown-aware reading (`<script id="qc-md">`) is a JavaScript port of `explain.py` from
  feedback-quote-audit (audit 1b, commit `d298ed9`). `md_parity.mjs` compares the class, the
  ellipsis and emphasis flags, the base verdict and the page's verdict with the Python reference on
  4,000 seeded synthetic cases from `make_md_cases.py`, in English, Spanish, German, Greek and
  Turkish, with odd spaces and decomposed accents. The build fails on any mismatch. The report is
  in [`parity/md-parity-report-v3.json`](parity/md-parity-report-v3.json). No real student text
  was used.
- One deliberate difference from `explain.py`: the page trusts a formatting step only when the
  words also match. So a quote found only inside a longer word ("he went" inside "she went") is
  not called "same words". `node_test_md.mjs` tests this and the other rules on short made-up
  sentences.

To repeat it (needs Python 3.12 and Node 20; `setup.sh` fetches the pinned files and checks
their SHA-256):

```bash
sh setup.sh
python build_page.py --base quote-check-v010.html --template page-template.html --out quote-check.html
python -m unittest -v test_quote_check_html.py test_build_page.py
node node_test.mjs quote-check.html
node node_test_i18n.mjs quote-check.html
node node_test_md.mjs quote-check.html
python make_cases.py --out cases.json && node parity.mjs quote-check.html cases.json
python make_md_cases.py --out cases-md.json && node md_parity.mjs quote-check.html cases-md.json
```

## Limits

- It checks copying, not whether the feedback is good or correct.
- Quotes are found by quotation marks; a quote the feedback does not mark is not checked.
- Capitals are folded close to Python's `casefold()`; a few rare letters may fold differently.
- Bold or italics inside a changed quote is taken to mark the change; a model can also bold words
  it did not change.
- Without Markdown-aware mode, a quote stitched from two distant sentences may show as changed or
  not found even if each half is exact.
- The "what the student wrote" passage is the closest window of about the quote's length; when
  several windows tie, the first one is shown.
- The page, its tests and its Spanish translation were made by AI agents and have not yet been
  reviewed by a teacher.

## Licence

Apache-2.0 (see LICENSE). By MV2 of Munim, Inc., mv2@munimtech.com.
