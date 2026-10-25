# Quote check (one offline page)

One HTML file a teacher can open in any browser to see whether AI writing feedback quoted a
student's words exactly, or quietly changed them. Paste the student's text and the feedback;
every passage the feedback puts in quotation marks is checked against the student's text.

**Open it in your browser:** https://rawcdn.githack.com/munimtechnologies/quote-check/v0.1.0/quote-check.html
(release v0.1.0 of this repository's `quote-check.html`, served as-is by the free raw.githack.com
CDN; the CDN only delivers the page, and the page itself sends nothing anywhere, see Privacy).

By MV2 of Munim, Inc. Made with AI agents working in his name. Apache-2.0.

## Why

Feedback that quotes a student is only useful if the quote is what the student wrote. Small AI
models sometimes "tidy" a quote as they copy it: a misspelling fixed, a word dropped, a verb
put in the right form. Then the student never sees their own error. In MV2's preregistered
studies on English learners' essays
([feedback-commons/research](https://github.com/munimtechnologies/feedback-commons/tree/main/research),
RESULTS-v3.md to RESULTS-v5.md), roughly one quote in ten to fifteen from two small local models
was not an exact copy (v5, powered: 1,314 of 1,416 matched quotes exact, about 93%). This page
makes that check something any teacher can do in seconds, and shows **what the student actually
wrote** next to each changed quote.

As far as we could find (web and GitHub search, 2026-10-24), no other tool checks whether AI
feedback quotes the student verbatim.

## Use

1. Open the link above, or download [`quote-check.html`](quote-check.html) (on its page, use
   "Download raw file") and open it in a browser by double-clicking. No install, no account.
2. Paste the student's text, then the AI feedback.
3. Press **Check quotes**.

Passages in "double quotes", “curly quotes”, «guillemets» or „low-high quotes“ are checked.
Single quotation marks are not, because they double as apostrophes; for those, tick **Each line
of the box is one quote** and paste one quote per line.

| Verdict | Meaning |
|---|---|
| Exact | the quote appears character for character in the student's text |
| Same words | every word matches in order; only punctuation, spacing or capitals differ |
| Changed words | close to a passage of the student's text, but words were added, dropped or changed; that passage is shown |
| Not found | no passage is close enough (word similarity below the threshold, default 0.6) |

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
downloaded file avoids even that.

## Same answers as the command-line tool

The checking code is a line-for-line JavaScript port of `verbatim_quote_check.py`
([feedback-commons `tools/`](https://github.com/munimtechnologies/feedback-commons/tree/main/tools),
tag v0.8.0), including Python difflib's `SequenceMatcher.ratio`. Before release it was checked
against the Python tool on 4,160 seeded synthetic cases over 13 synthetic source texts (exact
slices, case and punctuation changes, dropped, inserted, swapped and replaced words, accents in
both Unicode forms, Greek, Turkish, Chinese, Hindi, odd whitespace and quote marks, thresholds
from 0 to 1). The category, the similarity (bit for bit) and the word tokens matched in every
case: 0 mismatches, with Node v20.19.2 and Python 3.12.15 (Unicode 15.0.0). All four verdicts
were exercised (1,276 exact, 562 same words, 1,014 changed words, 1,308 not found). The report
is in [`parity/parity-report-v1.json`](parity/parity-report-v1.json). No real student text was used.

To repeat it (needs Python 3.12 and Node 20):

```bash
curl -fsSLO https://raw.githubusercontent.com/munimtechnologies/feedback-commons/v0.8.0/tools/verbatim_quote_check.py
python -m unittest -v test_quote_check_html.py
node node_test.mjs quote-check.html
python make_cases.py --out cases.json
node parity.mjs quote-check.html cases.json
```

## Limits

- It checks copying, not whether the feedback is good or correct.
- Quotes are found by quotation marks; a quote the feedback does not mark is not checked.
- "Changed words" uses word-level similarity, so a quote stitched from two distant sentences may
  show as changed or not found even if each half is exact.
- The "what the student wrote" passage is the closest window of about the quote's length; when
  several windows tie, the first one is shown.
- The page and its tests were made by AI agents and have not yet been reviewed by a teacher.

## Licence

Apache-2.0 (see LICENSE). By MV2 of Munim, Inc., mv2@munimtech.com.
