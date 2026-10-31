import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTikzRenderer, renderTikz } from '../src/index.js';
const picture = String.raw`\begin{tikzpicture}\draw[->] (-1,0)--(3,0);\draw[blue,thick] (0,0) circle (1);\node at (1,1) {$\frac{1}{2}$};\end{tikzpicture}`;

test('renders real standard TikZ, outlined math, and positive dimensions', async () => {
  const image = await renderTikz(picture);
  assert.match(image.svg, /<svg\b/); assert.match(image.svg, /<path\b/);
  assert(image.width > 10 && image.height > 10);
  assert.equal(Buffer.from(image.dataUrl.split(',')[1], 'base64').toString(), image.svg);
});
test('supports a complete pgfplots LaTeX document', async () => {
  const image = await renderTikz(String.raw`\documentclass[tikz,border=6pt]{standalone}
\usepackage{pgfplots}\pgfplotsset{compat=1.18}\begin{document}
\begin{tikzpicture}\begin{axis}[width=6cm,height=4cm,axis lines=middle]
\addplot[blue,domain=-2:2,samples=25] {x^2};\end{axis}\end{tikzpicture}\end{document}`);
  assert(image.width > image.height); assert.match(image.svg, /<path/);
});
test('rejects malformed TeX, multiple pages and invalid source', async () => {
  await assert.rejects(renderTikz(''), /1–12,000/);
  await assert.rejects(renderTikz('x'.repeat(12001)), /1–12,000/);
  await assert.rejects(renderTikz(String.raw`\begin{tikzpicture}\notARealCommand\end{tikzpicture}`), /valid page/);
  await assert.rejects(renderTikz(String.raw`\documentclass{article}\begin{document}one\newpage two\end{document}`), /valid page/);
});
test('does not expose the host filesystem to TeX', async () => {
  await assert.rejects(renderTikz(String.raw`\documentclass{article}\begin{document}\input{/etc/passwd}\end{document}`));
});
test('terminates execution, bounds the queue and releases slots after failure', async () => {
  const renderer = createTikzRenderer({ concurrency: 1, maxQueue: 0, timeoutMs: 1500 });
  const first = renderer.render(String.raw`\documentclass{article}\begin{document}\loop\iftrue\repeat\end{document}`);
  const failed = assert.rejects(first, /exceeded/);
  await assert.rejects(renderer.render(picture), /busy/);
  await failed;
  // A new process can run after a killed one; it must not be stuck behind its slot.
  const next = renderer.render(String.raw`\documentclass{article}\begin{document}\loop\iftrue\repeat\end{document}`);
  await assert.rejects(next, /exceeded/);
});
test('aborts queued work without consuming a slot, and kills active work', async () => {
  const renderer = createTikzRenderer({ concurrency: 1, maxQueue: 1 });
  const active = new AbortController(), waiting = new AbortController();
  const one = assert.rejects(renderer.render(picture, { signal: active.signal }), { name: 'AbortError' });
  const two = assert.rejects(renderer.render(picture, { signal: waiting.signal }), { name: 'AbortError' });
  waiting.abort(); active.abort(); await Promise.all([one, two]);
  assert((await renderer.render(picture)).width > 0);
});
test('enforces output size and validates configuration', async () => {
  assert.throws(() => createTikzRenderer({ concurrency: 0 }), /Invalid/);
  await assert.rejects(createTikzRenderer({ maxOutputBytes: 20 }).render(picture), /output too large/);
});

test('automatically selects LuaTeX for standard graphdrawing source', async () => {
  const image = await renderTikz(String.raw`\documentclass[tikz]{standalone}
\usetikzlibrary{graphs,graphdrawing}\usegdlibrary{trees}
\begin{document}\begin{tikzpicture}\graph [tree layout] {a -> {b,c}};
\end{tikzpicture}\end{document}`);
  assert(image.width > 0 && image.height > 0);
});
