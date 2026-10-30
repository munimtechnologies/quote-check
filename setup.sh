#!/bin/sh
# Setup for the quote-check.html v0.3.0 build + parity job: Node from Debian; the released v0.1.0
# page and its parity tools from munimtechnologies/quote-check at the fixed tag v0.1.0; the Python
# reference verbatim_quote_check.py from feedback-commons at the fixed tag v0.8.0; and audit 1's
# audit.py and audit 1b's explain.py from feedback-quote-audit at fixed commits. Every Python file
# is SHA-256-checked against the copy the audits ran with.
set -eu
cd "$(dirname "$0")"
apt-get update -qq && apt-get install -y -qq --no-install-recommends nodejs ca-certificates > /dev/null \
  || { echo "could not install nodejs" >&2; exit 1; }
node --version
python - <<'EOF'
import hashlib, sys, urllib.request
QC = "https://raw.githubusercontent.com/munimtechnologies/quote-check/v0.1.0/"
FQA = "https://raw.githubusercontent.com/munimtechnologies/feedback-quote-audit/"
files = {
    "quote-check-v010.html": (QC + "quote-check.html", None),
    "parity.mjs": (QC + "parity.mjs", None),
    "node_test.mjs": (QC + "node_test.mjs", None),
    "make_cases.py": (QC + "make_cases.py", None),
    "verbatim_quote_check.py": ("https://raw.githubusercontent.com/munimtechnologies/feedback-commons/v0.8.0/tools/verbatim_quote_check.py",
                                "d53b6b46a65024eca6ba5fa5e97d35c35c7da6d3bbe73f5362cb9e268bf15e04"),
    "audit.py": (FQA + "0d1c75a4aee4305df1dc90325462f8fb4b544ab7/audit.py",
                 "028c0d8d337f6ff07681bc7ee7c5d35b143c7cde645ae658b95f777df864965c"),
    "explain.py": (FQA + "d298ed97db6460842624d13bea82dad8c76f53ae/explain.py",
                   "9f2959daf096d4df4cc9171a9c64d163255291540551f13fb4a8ff26957d14d6"),
}
for name, (url, want) in files.items():
    data = urllib.request.urlopen(url, timeout=60).read()
    got = hashlib.sha256(data).hexdigest()
    if want and got != want:
        sys.exit("%s: SHA-256 %s, expected %s" % (name, got, want))
    open(name, "wb").write(data)
    print(name, len(data), got)
if b'<script id="qc-core">' not in open("quote-check-v010.html", "rb").read():
    sys.exit("quote-check.html at v0.1.0 has no qc-core block")
EOF
sha256sum page-template.html build_page.py make_md_cases.py md_parity.mjs node_test_md.mjs node_test_i18n.mjs
