#!/usr/bin/env bash
# Patch the WEB source before tangle/web2c generates C. Keep the pinned vendor
# source unchanged, and let make's local files override its VPATH source files.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$REPO/vendor/texlive-source/texk/web2c/pdftexdir/pdftex.web"
OUTPUT="$REPO/vendor/native-build/texk/web2c"
STAGED=$(mktemp -d)
trap 'rm -rf "$STAGED"' EXIT
cp "$SOURCE" "$STAGED/pdftex.web"
for file in "$REPO"/patches/pdftex/*.patch; do
  patch --batch --fuzz=0 -s -p1 -d "$STAGED" < "$file"
done
mkdir -p "$OUTPUT/pdftexdir"
# tie reads pdftexdir/pdftex.web; tangle's WEBINPUTS starts with the build root.
for file in "$OUTPUT/pdftexdir/pdftex.web" "$OUTPUT/pdftex.web"; do
  if ! cmp -s "$STAGED/pdftex.web" "$file"; then cp "$STAGED/pdftex.web" "$file"; fi
done
