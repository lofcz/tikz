// Regenerate build-time co-read groups from real documents, never runtime telemetry.
import { writeFile } from 'node:fs/promises';
import { MetaPost } from '../runtime/dist/index.js';
import { nodeIO } from '../runtime/dist/node.js';
import { fixtures } from '../benchmarks/fixtures.mjs';
const cases = {
  ...fixtures,
  decorations: String.raw`\documentclass[tikz]{standalone}\usetikzlibrary{decorations.pathmorphing,patterns.meta}\begin{document}\begin{tikzpicture}\draw[decorate,decoration=zigzag] (0,0)--(2,1);\fill[pattern={Lines[angle=45]}] (0,0) rectangle (1,1);\end{tikzpicture}\end{document}`,
  circuit: String.raw`\documentclass[tikz]{standalone}\usepackage{circuitikz}\begin{document}\begin{circuitikz}\draw (0,0) to[R=$R$] (2,0);\end{circuitikz}\end{document}`,
  commutative: String.raw`\documentclass{standalone}\usepackage{tikz-cd}\begin{document}\begin{tikzcd}A\arrow[r,"f"]&B\end{tikzcd}\end{document}`,
};
const usage = {};
for (const [i, [name, source]] of Object.entries(cases).entries()) {
  const io = await nodeIO();
  const observe = url => {
    const match = decodeURIComponent(new URL(url).pathname).match(/\/bundles\/([^/]+)\/files\/(.+)$/);
    if (match) { const [, bundle, path] = match; (usage[bundle] ??= {})[path] = (usage[bundle][path] ?? 0) | (1 << i); }
  };
  const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent', bundleIO: {
    fetchJson: io.fetchJson,
    fetch: async url => { observe(url); return io.fetch(url); },
    fetchSync: url => { observe(url); return io.fetchSync(url); },
  } });
  try {
    const result = await engine.latex(source, { engine: 'auto', fonts: 'paths' });
    if (result.status !== 'ok') throw new Error(`${name}: ${JSON.stringify(result.diagnostics)}`);
    console.log(`${name}: ${result.format}`);
  } finally { engine.dispose(); }
}
const ordered = Object.fromEntries(Object.entries(usage).sort().map(([name, files]) => [name, Object.fromEntries(Object.entries(files).sort())]));
await writeFile(new URL('./data/bundle-usage.json', import.meta.url), JSON.stringify(ordered, null, 2)+'\n');
