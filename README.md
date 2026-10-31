# @lofcz/tikz

Render standard TikZ and standalone LaTeX to SVG using
[jmckalex/mp-tikz-wasm](https://github.com/jmckalex/mp-tikz-wasm). Node 22.19+ and
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
are accepted unchanged. Snippets receive a standalone wrapper and the standard
calc, intersections, angles, quotes, arrows.meta and positioning libraries.
pgfplots is available through `\usepackage{pgfplots}` in a complete document.

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
limits when serving untrusted workloads. This is a server package; browser apps
should call their own rendering endpoint.

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
the full package including `runtime/`; copying only JavaScript is insufficient.

## Development and first publication

```sh
npm ci
npm run check
npm run bootstrap -- --dry-run
```

Build downloads the checksum-pinned upstream archive once and selects the default
bundles. Set `TIKZ_ARCHIVE=/path/to/upstream.tar.gz` to build offline; the same
checksum is always enforced. The npm tarball includes all selected runtime assets
and their notices. Tests render real TikZ/pgfplots, exercise cancellation/limits,
and install the packed tarball offline before rendering from a relocated
function directory with the original installation removed.

For the **first manual release**, use Node 22.19+ and npm 11.19+ in an interactive
terminal:

```sh
npm login
npm run bootstrap
```

The bootstrap validates and publishes the real `0.1.0` package, then runs:

```sh
npm trust github @lofcz/tikz --file release.yml --repo lofcz/tikz --allow-publish --yes
```

Complete npm's interactive 2FA prompts. No npm token is stored in this repository
or GitHub secrets. If publishing succeeds but trust setup is interrupted, rerun
the bootstrap: an already-published version is skipped and trust setup resumes.

Subsequent releases follow the Edix workflow: manually select patch/minor/major,
validate, bump and tag, publish with OIDC/provenance, then push and create a release:

```sh
gh workflow run release.yml -R lofcz/tikz -f release_type=patch
```

The workflow cannot bootstrap an npm package name that has no trusted publisher;
run the manual step once first. Runtime licensing and rebuild/source links are
in [NOTICE.md](NOTICE.md).
