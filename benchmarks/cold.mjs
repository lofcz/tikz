import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fixtures } from './fixtures.mjs';

if (process.argv[2] === 'sample') {
  const root = resolve(process.argv[3]), fixture = process.argv[4], wrapper = process.argv[5] === 'wrapper';
  let missingReads = 0, decompressedBytes = 0, bundleReads = 0;
  const read = fs.readFileSync, decompress = zlib.brotliDecompressSync;
  fs.readFileSync = function(path, ...args) {
    const bundle = String(path).includes('/bundles/');
    if (bundle) bundleReads++;
    try { return read.call(this, path, ...args); }
    catch (error) { if (bundle && error.code === 'ENOENT') missingReads++; throw error; }
  };
  zlib.brotliDecompressSync = function(...args) { const bytes = decompress.apply(this, args); decompressedBytes += bytes.length; return bytes; };
  syncBuiltinESMExports();
  const start = performance.now(), cpu = process.cpuUsage();
  let svg;
  if (wrapper) {
    const { renderTikz } = await import(pathToFileURL(`${root}/src/index.js`));
    svg = (await renderTikz(fixtures[fixture])).svg;
  } else {
    const { MetaPost } = await import(pathToFileURL(`${root}/runtime/dist/index.js`));
    const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent' });
    const image = await engine.latex(fixtures[fixture], { engine: 'auto', fonts: 'paths' });
    if (image.status !== 'ok' || image.pages.length !== 1) throw new Error(JSON.stringify(image.diagnostics));
    svg = image.pages[0]; engine.dispose();
  }
  console.log(JSON.stringify({ fixture, wrapper, ms: performance.now() - start,
    cpuMs: (process.cpuUsage(cpu).user + process.cpuUsage(cpu).system) / 1000,
    peakRssMiB: process.resourceUsage().maxRSS / 1024, missingReads, bundleReads, decompressedBytes,
    outputBytes: Buffer.byteLength(svg), sha: createHash('sha256').update(svg).digest('hex') }));
} else {
  const roots = process.argv.slice(2);
  if (!roots.length) throw new Error('Pass baseline and candidate package directories');
  const results = [];
  for (const fixture of Object.keys(fixtures)) for (let round = 0; round < Number(process.env.BENCH_ROUNDS ?? 3); round++) {
    for (const root of round % 2 ? [...roots].reverse() : roots) {
      const sample = JSON.parse(execFileSync(process.env.BENCH_NODE ?? process.execPath,
        [fileURLToPath(import.meta.url), 'sample', root, fixture, process.env.BENCH_WRAPPER ? 'wrapper' : 'engine'],
        { encoding: 'utf8', timeout: 120_000 }));
      results.push({ root, round, ...sample });
    }
  }
  for (const fixture of Object.keys(fixtures)) {
    if (new Set(results.filter(r => r.fixture === fixture).map(r => r.sha)).size !== 1) throw new Error(`Output differs for ${fixture}`);
    for (const root of roots) {
      const samples = results.filter(r => r.root === root && r.fixture === fixture);
      const med = key => samples.map(r => r[key]).sort((a,b) => a-b)[Math.floor(samples.length / 2)];
      console.log(JSON.stringify({ root, fixture, samples: samples.length,
        ...Object.fromEntries(['ms','cpuMs','peakRssMiB','missingReads','bundleReads','decompressedBytes','outputBytes'].map(k => [k, +med(k).toFixed(2)])) }));
    }
  }
  if (process.env.BENCH_OUTPUT) fs.writeFileSync(process.env.BENCH_OUTPUT, JSON.stringify({ node: process.version, results }, null, 2));
}
