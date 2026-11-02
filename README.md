# @lofcz/tikz

Render standard TikZ and standalone LaTeX to SVG using
our maintained [mp-tikz-wasm fork](https://github.com/lofcz/mp-tikz-wasm). Node 22.19+ and
Bun with Node on PATH. No system TeX installation, network access, runtime
download, install script, framework, or API key is needed by consumers.

```sh
npm install @lofcz/tikz
```

```js
import { renderTikz } from '@lofcz/tikz';

const image = await renderTikz(String.raw`
\begin{tikzpicture}
  \draw[->] (-2,0) -- (2,0);
  \draw[blue,thick] (0,0) circle (1);
  \node at (1,1) {$\frac{1}{2}$};
\end{tikzpicture}
`);
// image.svg, image.width, image.height, image.dataUrl
```

Use `dataUrl` as an image source. Do not insert untrusted SVG as HTML. Text is
outlined, so the image does not need web fonts. Full `\documentclass` documents
are normalized to a standalone document. Snippets receive a standalone wrapper and the standard
calc, intersections, angles, quotes, arrows.meta and positioning libraries.
pgfplots is available through `\usepackage{pgfplots}` in a complete document.

Both entries enable the fork's lazy engine loading: TikZ skips MetaPost WASM,
optional glue loads only when used, and graph-drawing documents automatically
select LuaTeX. The browser entry also uses precompiled formats: ordinary TikZ selects a smaller
basic format, while explicit pgfplots/tikz-cd documents use the full format.
Additional libraries remain available and load normally. Each document still gets
a fresh TeX/WASM execution state. These
savings do not require cross-request caches, including on Vercel Fluid Node
functions. The server entry keeps CPU-bound TeX outside the shared request loop.

## Limits and cancellation

One page; 12,000 source characters; 30 seconds per execution and queue wait;
4 MB output; two running processes and eight queued jobs per renderer instance.
Only bundled TeX packages, no external files. Rendering does not verify the
mathematics. The default `renderTikz` shares one renderer within a process.

```js
import { createTikzRenderer } from '@lofcz/tikz';
const renderer = createTikzRenderer({ concurrency: 1, maxQueue: 4, timeoutMs: 15_000 });
const image = await renderer.render(source, { signal: AbortSignal.timeout(10_000) });
```

Each request runs in a fresh child process with an empty environment and WASM
virtual filesystem. Timeouts/aborts kill that process, including synchronous TeX
loops; queue capacity is not released until the process closes. The Node heap
limit is 512 MB, not a total RSS/WASM memory limit. Apply container/OS resource
limits when serving untrusted workloads. Browser apps use the worker entry below; backend generation uses the Node entry.

## Source normalization

Source is parsed by unified-latex's PEG parser. AST passes handle nested groups,
macro arguments, environments, PGF key lists and document-defined macros. Both
workers bundle the parser; consumers install no extra JavaScript dependencies.

Normalization accepts Markdown fences, escaped tool strings, loose drawing commands
and full documents. It hoists preamble commands, unwraps document/slide decoration,
preserves coordinate names, repairs bare math in labels, maps supported Unicode and
colour names, and moves font colour switches into TikZ's `text=` key. Compiler
failures identify the offending command/key and show source context. Unknown
packages cannot be fetched at runtime; normalization reports them in diagnostics.
This is a compatibility layer, not a general TeX interpreter or a check that the
geometry is correct. Missing fonts, arbitrary macros and malformed geometry can
still require source changes.

The bundled TeX tree includes tkz-euclide/tkz-base, siunitx, mhchem, pgf-pie,
tikz-qtree, forest, smartdiagram, physics and cancel with their dependencies.
Known package use is detected automatically; explicit `\usepackage` also works.
The engine indexes these files at startup but reads/fetches their contents only
when compilation needs them. An ordinary picture does not download their macros.
The package archives are pinned to TeX Live 2025 with SHA-256 checksums in
`scripts/data/extra-packages.json`, matching the engine's LaTeX format.

## Browser rendering

Compile locally in a dedicated Web Worker:

```js
import { createTikzRenderer } from '@lofcz/tikz/browser';
const renderer = createTikzRenderer({ assetBaseUrl: '/tikz/' });
const image = await renderer.render(source, { signal });
// On teardown: renderer.dispose();
```

Copy static assets during your app build and serve them from that same-origin URL:

```js
import { copyTikzBrowserAssets } from '@lofcz/tikz/deploy';
await copyTikzBrowserAssets('public/tikz');
```

The helper expands compressed TeX bundles for ordinary static hosting. WASM and
TeX files load lazily on the first figure, with normal HTTP caching; there is no
rendering endpoint or CDN dependency. The worker is reused for successive figures
and terminated on cancellation, failure, or the 30-second compilation deadline.
Initial runtime loading has a separate 60-second deadline. Eight jobs may queue.
Call `dispose()` when the host is destroyed. Use versioned asset URLs on deployment.

With Streamdown, pass `render: source => renderer.render(source)` to
`createTikzPlugin`. The plugin displays the returned `dataUrl` as an isolated image.

## Bundlers and deployment

Ordinary Node/Bun installs work directly. Keep `@lofcz/tikz` external when
possible. For a standalone serverless artifact that omits node_modules:

```js
import { copyTikzAssets } from '@lofcz/tikz/deploy';
await copyTikzAssets('.vercel/output/functions/render.func');
```

This copies the complete package into that function's node_modules. The small
entry module can also be bundled: it resolves `@lofcz/tikz/package.json` from the
output location, rather than resolving WASM relative to a relocated chunk. Call
the helper for each function that includes the renderer. File tracers must retain
the full package including `dist/` and `runtime/`; copying only JavaScript is insufficient.

## Development

```sh
npm ci
npm run check
npm run test:browser
npm run bench:cold
```

The engine source lives in `packages/engine`, imported from upstream v0.5.0 as a
Git subtree. Every build compiles this source. Native WASM and TeX data come from
a checksum-pinned release in our fork; their original build provenance is recorded
in `upstream.json`. Set `TIKZ_ARCHIVE=/path/to/archive.tar.gz` for offline builds.
The native binaries are the upstream baseline, not a new native compilation.
The basic format is generated during the build by the pinned WASM, using the
pinned LaTeX format and `packages/engine/bundles/tex/tikz-basic-snapshot.tex`.
It requires no host TeX installation. Regenerate co-read groups with
`node scripts/profile-bundle-usage.mjs`, then rebuild. These groups only control
archive layout; they never restrict which files a document may use.

The server distribution uses Brotli chunks targeting 512 KiB uncompressed (larger
individual files stay intact). Files read together by representative diagrams are
grouped at build time; uncommon files remain available on demand. Each render
decompresses only the chunks it reads;
manifest metadata avoids speculative raw-file reads. Directory and `ls-R` indexes
are prepared at build time for the default bundle set. Custom bundle sets rebuild
their indexes, and browser assets use individual files without an extra index fetch. It retains all ten default bundles, including pgfplots and LuaTeX.
The engine source still supports ordinary uncompressed assets and browser I/O.


Tests render real TikZ/pgfplots, exercise cancellation and limits, and install the
packed tarball offline before rendering from a relocated function directory.

For engine development and native rebuilds, see [packages/engine](packages/engine).
Mirror engine changes to the fork with:

```sh
git subtree push --prefix=packages/engine https://github.com/lofcz/mp-tikz-wasm.git tikz-monorepo
```

Release through GitHub Actions with npm trusted publishing:

```sh
gh workflow run release.yml -R lofcz/tikz -f release_type=patch
```

Licensing and native source links are in [NOTICE.md](NOTICE.md).

Building the extra TeX bundle requires `xz` on PATH. Package archives are cached
in `scripts/data/texlive/`; builds verify their checksums before extraction.
