// Bundle the two workers so consumers need no runtime dependencies: the Node
// worker runs from a standalone function artifact (copyTikzAssets) and the
// browser worker is served as a static module (copyTikzBrowserAssets). The
// engine (`../runtime/dist/index.js`) stays external at the same relative path,
// so `dist/` sits beside `src/` and `runtime/`.
import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(new URL('../dist', import.meta.url), { recursive: true });
const shared = { bundle: true, format: 'esm', minify: false, sourcemap: false, legalComments: 'none', external: ['../runtime/dist/index.js'], logLevel: 'warning', absWorkingDir: root };
const built = await build({ ...shared, metafile: true, entryPoints: ['src/worker.js'], outfile: 'dist/worker.js', platform: 'node', target: 'node22' });
await build({ ...shared, entryPoints: ['src/browser-worker.js'], outfile: 'dist/browser-worker.js', platform: 'browser', target: 'es2022', minify: true });
console.log('Bundled dist/worker.js and dist/browser-worker.js');

const packages = new Map();
for (const input of Object.keys(built.metafile.inputs).filter(path => path.startsWith('node_modules/'))) {
  let directory = dirname(join(root, input));
  while (directory.startsWith(join(root, 'node_modules'))) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (!packages.has(manifest.name)) {
        const names = (await readdir(directory)).filter(name => /^licen[sc]e(?:\.|$)/i.test(name));
        const licenses = await Promise.all(names.map(name => readFile(join(directory, name), 'utf8')));
        packages.set(manifest.name, `${manifest.name}@${manifest.version} (${manifest.license ?? 'see source'})\n${licenses.join('\n')}`);
      }
      break;
    } catch { directory = dirname(directory); }
  }
}
await writeFile(join(root, 'dist/THIRD_PARTY_LICENSES.txt'), [...packages.values()].sort().join('\n\n---\n\n'));
