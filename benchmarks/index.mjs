// Isolate index construction from TeX/WASM execution. Each sample owns a new BundleSet.
import { readFile } from 'node:fs/promises';
import { BundleSet } from '../runtime/dist/vfs/bundle.js';
import { nodeIO } from '../runtime/dist/node.js';
const pin = JSON.parse(await readFile(new URL('../upstream.json', import.meta.url)));
const specs = pin.bundles.map(name => ({ name,
  manifestUrl: new URL(`../runtime/dist/bundles/${name}/`, import.meta.url).href }));
const samples = { dynamic: [], prebuilt: [] };
for (let i = 0; i < 40; i++) for (const mode of i % 2 ? ['prebuilt', 'dynamic'] : ['dynamic', 'prebuilt']) {
  const bundles = new BundleSet(await nodeIO());
  await bundles.addAll(specs);
  const start = performance.now();
  if (mode === 'prebuilt') await bundles.loadFilesystemIndex(new URL('../runtime/dist/bundles/filesystem.json', import.meta.url).href);
  bundles.exportFilesystemIndex();
  samples[mode].push(performance.now() - start);
}
for (const [mode, times] of Object.entries(samples))
  console.log(JSON.stringify({ mode, samples: times.length, medianMs: times.sort((a,b) => a-b)[20] }));
