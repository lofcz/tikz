import { execFileSync } from 'node:child_process';
import { brotliCompressSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tar';
import { prepareExtraPackages } from './prepare-extra-packages.mjs';
import { buildBasicFormat } from './build-basic-format.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const pin = JSON.parse(await readFile(join(root, 'upstream.json'), 'utf8'));
const target = join(root, 'runtime');
const bundleNames = [...pin.bundles, 'tikz-extra'];
const buildKey = createHash('sha256');
for (const path of ['scripts/prepare-runtime.mjs', 'scripts/prepare-extra-packages.mjs', 'scripts/data/extra-packages.json', 'scripts/build-basic-format.mjs', 'scripts/data/bundle-usage.json', 'packages/engine/bundles/tex/tikz-basic-snapshot.tex'])
  buildKey.update(await readFile(join(root, path)));
const recipeKey = buildKey.digest('hex');
let cached = false;
try {
  const installed = JSON.parse(await readFile(join(target, 'upstream.json'), 'utf8'));
  if (JSON.stringify(installed) === JSON.stringify(pin) && (await readFile(join(target, '.build-key'), 'utf8')) === recipeKey) {
    await access(join(target, 'dist/tex.wasm'));
    await access(join(target, 'dist/index.js'));
    console.log(`mp-tikz-wasm ${pin.version} ready`);
    cached = true;
  }
} catch {}
let rawReady = false;
try {
  const installed = JSON.parse(await readFile(join(target, 'upstream.json'), 'utf8'));
  if (JSON.stringify(installed) === JSON.stringify(pin)) { await access(join(target, 'dist/bundles/core/files')); rawReady = true; }
} catch {}
if (!cached && !rawReady) {
  const temporary = await mkdtemp(join(tmpdir(), 'tikz-build-'));
  try {
    const archive = process.env.TIKZ_ARCHIVE
      ? await readFile(process.env.TIKZ_ARCHIVE)
      : Buffer.from(await (async () => {
        const response = await fetch(pin.archive, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`Upstream download failed: ${response.status}`);
        return response.arrayBuffer();
      })());
    if (createHash('sha256').update(archive).digest('hex') !== pin.sha256)
      throw new Error('mp-tikz-wasm archive checksum mismatch');
    const archivePath = join(temporary, 'upstream.tgz');
    await writeFile(archivePath, archive);
    await x({ file: archivePath, cwd: temporary, strict: true,
      filter: (name, entry) => !['SymbolicLink', 'Link'].includes(entry.type) &&
        !name.split('/').some(part => part.startsWith('._') || part === '__MACOSX') });
    const upstream = join(temporary, `mp-tikz-wasm-${pin.version}`);
    const staged = join(root, `.runtime-${process.pid}`);
    try {
      await mkdir(staged, { recursive: true });
      await cp(join(upstream, 'dist'), join(staged, 'dist'), {
        recursive: true,
        filter: (source) => {
          const parts = relative(join(upstream, 'dist'), source).split(sep);
          return parts[0] !== 'ghostscript' &&
            !(parts[0] === 'bundles' && parts.length > 1 &&
              !pin.bundles.includes(parts[1]) && !['hot.json', 'index.json'].includes(parts[1]));
        },
      });
      for (const name of ['LICENSE', 'NOTICE.md', 'licenses'])
        await cp(join(upstream, name), join(staged, name), { recursive: true });
      // Preserve ESM semantics even when copied outside a type:module application.
      await writeFile(join(staged, 'package.json'), JSON.stringify({ type: 'module', version: pin.version }));
      await writeFile(join(staged, 'upstream.json'), JSON.stringify(pin, null, 2));
      await rm(target, { recursive: true, force: true });
      await rename(staged, target);
    } finally { await rm(staged, { recursive: true, force: true }); }
    console.log(`Prepared mp-tikz-wasm ${pin.version}; default bundles only`);
  } finally { await rm(temporary, { recursive: true, force: true }); }

}
// Always compile our maintained sources, including when native assets are cached.
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
  '-p', join(root, 'packages/engine/tsconfig.build.json')], { stdio: 'inherit' });
await cp(join(root, 'packages/engine/dist'), join(target, 'dist'), {
  recursive: true, filter: async source => (await stat(source)).isDirectory() || /\.(js|d\.ts)$/.test(source),
});
if (!cached) await buildBasicFormat(target, pin.bundles);
await prepareExtraPackages(root, target);
await cp(join(root, 'scripts/data/extra-packages.json'), join(target, 'extra-packages.json'));
const usage = JSON.parse(await readFile(join(root, 'scripts/data/bundle-usage.json'), 'utf8'));
// Bounded archives avoid inflating a whole font/macro bundle for one file.
const bundleRoot = join(target, 'dist/bundles');
const chunkLimit = 512 * 1024;
for (const name of bundleNames) {
  const directory = join(bundleRoot, name);
  try { await access(join(directory, 'files')); } catch { continue; }
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const index = Object.create(null);
  let chunks = [], offset = 0, chunkNumber = 0;
  await mkdir(join(directory, 'chunks'), { recursive: true });
  async function flush() {
    if (!chunks.length) return;
    await writeFile(join(directory, `chunks/${chunkNumber}.br`), brotliCompressSync(Buffer.concat(chunks), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 9 },
    }));
    chunks = []; offset = 0; chunkNumber++;
  }
  const group = path => usage[name]?.[path] ?? 0;
  const entries = Object.entries(manifest.files).sort(([a], [b]) =>
    group(b) - group(a) || (a < b ? -1 : a > b ? 1 : 0));
  let previousGroup;
  for (const [path, expected] of entries) {
    const bytes = await readFile(join(directory, 'files', path));
    if (bytes.length !== expected.size || createHash('sha256').update(bytes).digest('hex').slice(0, expected.sha.length) !== expected.sha)
      throw new Error(`Bundle manifest mismatch: ${name}/${path}`);
    if (offset && (offset + bytes.length > chunkLimit || group(path) !== previousGroup)) await flush();
    previousGroup = group(path);
    index[path] = [`chunks/${chunkNumber}.br`, offset, bytes.length]; chunks.push(bytes); offset += bytes.length;
  }
  await flush();
  manifest.storage = 'brotli-chunks-v1';
  manifest.filesystemKey = createHash('sha256').update(JSON.stringify([manifest.files, manifest.dirs])).digest('hex');
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(directory, 'files.index.json'), JSON.stringify(index));
  await rm(join(directory, 'files'), { recursive: true });
}
// Indexes are immutable package data, so construct them once at build time.
const { BundleSet } = await import(new URL('../runtime/dist/vfs/bundle.js', import.meta.url));
const { nodeIO } = await import(new URL('../runtime/dist/node.js', import.meta.url));
const bundles = new BundleSet(await nodeIO());
await bundles.addAll(bundleNames.map(name => ({ name, manifestUrl: new URL(`../runtime/dist/bundles/${name}/`, import.meta.url).href })));
await writeFile(join(bundleRoot, 'filesystem.json'), JSON.stringify(bundles.exportFilesystemIndex()));
await writeFile(join(target, '.build-key'), recipeKey);
console.log('Compiled fork engine; indexed chunked bundles ready');
