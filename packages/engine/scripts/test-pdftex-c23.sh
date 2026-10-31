#!/usr/bin/env bash
# Exercise both values of the renamed conversion flag using actual pdfTeX primitives.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PDFTEX="$REPO/vendor/native-build/texk/web2c/pdftex"
TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT
printf '%s' abc > "$TEMP/input.txt"
cat > "$TEMP/texmf.cnf" <<'CONFIG'
TEXINPUTS = .
max_print_line = 1000
CONFIG
cat > "$TEMP/probe.tex" <<'TEX'
\catcode123=1 \catcode125=2
\pdfoutput=1
\message{C23-MD5-TEXT:\pdfmdfivesum{abc}}
\message{C23-MD5-FILE:\pdfmdfivesum file {input.txt}}
\message{C23-MATCH-SENSITIVE:\pdfmatch{abc}{ABC}}
\message{C23-MATCH-INSENSITIVE:\pdfmatch icase {abc}{ABC}}
\ifnum\pdfcolorstackinit page direct{0 g}>0 \message{C23-PAGE-STACK:OK}\else\errmessage{Page stack failed}\fi
\ifnum\pdfcolorstackinit direct{0 g}>0 \message{C23-STACK:OK}\else\errmessage{Stack failed}\fi
\end
TEX
if ! (cd "$TEMP" && TEXMFCNF="$TEMP" "$PDFTEX" -ini -interaction=nonstopmode -halt-on-error probe.tex > output.log); then
  cat "$TEMP/output.log"
  exit 1
fi
for result in \
  'C23-MD5-TEXT:900150983CD24FB0D6963F7D28E17F72' \
  'C23-MD5-FILE:900150983CD24FB0D6963F7D28E17F72' \
  'C23-MATCH-SENSITIVE:0' 'C23-MATCH-INSENSITIVE:1' \
  'C23-PAGE-STACK:OK' 'C23-STACK:OK'; do
  if ! grep -Fq "$result" "$TEMP/output.log"; then cat "$TEMP/output.log"; echo "Missing: $result" >&2; exit 1; fi
done
printf '%s\n' 'PASS pdfTeX: string/file MD5, case-sensitive/insensitive matching, ordinary/page color stacks'
