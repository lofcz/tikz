import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaPost } from '../runtime/dist/index.js';
import { fixtures } from '../benchmarks/fixtures.mjs';
const cases = {
  simple: fixtures.simple,
  plot: fixtures.plot,
  extraLibraries: String.raw`\documentclass[tikz]{standalone}\usetikzlibrary{decorations.pathmorphing,patterns.meta,bending}\begin{document}\begin{tikzpicture}\draw[decorate,decoration=zigzag] (0,0)--(2,1);\fill[pattern={Lines[angle=45]}] (0,0) rectangle (1,1);\end{tikzpicture}\end{document}`,
  commutative: String.raw`\documentclass{standalone}\usepackage{tikz-cd}\begin{document}\begin{tikzcd} A\arrow[r,"f"] & B\end{tikzcd}\end{document}`,
  utf8: String.raw`\documentclass[tikz]{standalone}\usepackage{lmodern}\usepackage[T1]{fontenc}\begin{document}\begin{tikzpicture}\node {Příliš žluťoučký kůň};\end{tikzpicture}\end{document}`,
};
for (const [name, source] of Object.entries(cases)) test(`basic/full/unprepared formats preserve ${name}`, async () => {
  const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent' });
  try {
    const results = [];
    for (const snapshot of ['none','auto','tikz']) {
      const result = await engine.latex(source, { snapshot });
      assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics)); results.push(result);
    }
    assert.deepEqual(results[1].pages, results[0].pages, 'automatic format changes SVG');
    // The legacy full snapshot preallocates pattern IDs; their numbers are opaque.
    const ids = svg => { const names = new Map(); return svg.replace(/\bpgf(?:pat|sym)\d+\b/g, name => { if (!names.has(name)) names.set(name, 'pattern-id-'+names.size); return names.get(name); }); };
    assert.deepEqual(results[2].pages.map(ids), results[0].pages.map(ids), 'full format changes SVG beyond opaque IDs');
    assert.equal(results[1].format, ['plot','commutative'].includes(name) ? 'tikz' : 'tikz-basic');
  } finally { engine.dispose(); }
});
