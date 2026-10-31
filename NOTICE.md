# Third-party runtime

This wrapper maintains a fork of mp-tikz-wasm 0.5.0 by jmckalex, based on commit
d44aeeba98b0e60d13c35dfd080076e6b05c68b5. `upstream.json` records the archive and
SHA-256. Only package maintainers download the native baseline from our fork during `npm run build`.
Engine TypeScript is compiled from `packages/engine` in https://github.com/lofcz/tikz;
the fork is mirrored at https://github.com/lofcz/mp-tikz-wasm/tree/tikz-monorepo.

The wrapper is GPL-3.0-or-later. Runtime components and fonts retain their
respective licenses; see the complete upstream `runtime/NOTICE.md`,
`runtime/LICENSE` and `runtime/licenses/`, included in every npm package.
The runtime includes GPL pdfTeX/LuaTeX/dvisvgm, LGPL glue, and separately licensed
TeX macros and fonts. This is not an MIT-only distribution.

Only the ten upstream default bundles are shipped. Optional Classico (AFPL),
Ghostscript, latex-doc, OpenType and otf-fonts bundles are excluded. No Ghostscript
engine is included. Native binaries and macro contents are unchanged. Bundle payloads are Brotli-compressed
without changing their contents. Our Node I/O decompresses them on demand and
uses portable file URL handling. Engine glue supports lazy optional module loading
and TeX-only execution without initializing MetaPost. Browser I/O still uses uncompressed assets.

Corresponding upstream source, patches and reproducible build instructions:
https://github.com/jmckalex/mp-tikz-wasm/tree/d44aeeba98b0e60d13c35dfd080076e6b05c68b5
Source archive:
https://github.com/jmckalex/mp-tikz-wasm/archive/d44aeeba98b0e60d13c35dfd080076e6b05c68b5.tar.gz
Pinned engine sources:
https://github.com/jmckalex/mp-tikz-wasm/blob/d44aeeba98b0e60d13c35dfd080076e6b05c68b5/vendor/SOURCES.lock

See the upstream Makefile, vendor/ and patches/ for rebuilding/replacing the
runtime. The package resolves its runtime from its own install directory;
consumers can replace those files with compatible rebuilt versions.
