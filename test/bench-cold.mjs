import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

if (process.argv[2]) {
  const lazy = process.argv[2] === 'lazy';
  const start = performance.now();
  const { MetaPost } = await import('../runtime/dist/index.js');
  const engine = await MetaPost.create({ worker: false, lazy, logLevel: 'silent' });
  const initialized = performance.now();
  const result = await engine.latex(String.raw`\documentclass[tikz]{standalone}\begin{document}\begin{tikzpicture}\draw (0,0)--(2,1);\node at (1,1) {$\frac{1}{2}$};\end{tikzpicture}\end{document}`, { fonts: 'paths' });
  if (result.status !== 'ok') throw new Error(JSON.stringify(result.diagnostics));
  engine.dispose();
  console.log(JSON.stringify({ lazy, initMs: initialized - start, totalMs: performance.now() - start,
    peakRssMiB: process.resourceUsage().maxRSS / 1024,
    svgHash: createHash('sha256').update(result.pages[0]).digest('hex') }));
} else {
  const results = [];
  for (let i = 0; i < 5; i++) for (const mode of i % 2 ? ['lazy', 'eager'] : ['eager', 'lazy']) {
    results.push(JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), mode], { encoding: 'utf8', timeout: 60_000 })));
  }
  if (new Set(results.map(r => r.svgHash)).size !== 1) throw new Error('Eager and lazy render outputs differ');
  const median = values => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
  for (const lazy of [false, true]) {
    const runs = results.filter(r => r.lazy === lazy);
    console.log(JSON.stringify({ mode: lazy ? 'lazy' : 'eager', freshProcesses: runs.length,
      ...Object.fromEntries(['initMs','totalMs','peakRssMiB'].map(key => [key, +median(runs.map(r => r[key])).toFixed(2)])) }));
  }
  console.log('All fresh processes produced identical SVG bytes. No cross-request cache.');
}
