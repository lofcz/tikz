import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaPost } from '../runtime/dist/index.js';

test('compact engine retains LuaTeX graph drawing', { timeout: 30_000 }, async () => {
  const engine = await MetaPost.create({ worker: false, logLevel: 'silent' });
  try {
    const result = await engine.latex(String.raw`\documentclass[tikz]{standalone}
\usetikzlibrary{graphs,graphdrawing}\usegdlibrary{trees}
\begin{document}\begin{tikzpicture}\graph [tree layout] {a -> {b,c}};
\end{tikzpicture}\end{document}`, { engine: 'lualatex', fonts: 'paths' });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.equal(result.pages.length, 1);
    assert.match(result.pages[0], /<svg/);
  } finally { engine.dispose(); }
});
