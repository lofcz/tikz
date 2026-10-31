import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

/** Copy a complete package into an otherwise standalone Node function artifact. */
export async function copyTikzAssets(functionDirectory) {
  const source = dirname(createRequire(import.meta.url).resolve('@lofcz/tikz/package.json'));
  const destination = resolve(functionDirectory, 'node_modules/@lofcz/tikz');
  if (await realpath(destination).catch(() => '') === await realpath(source))
    throw new Error('TikZ deployment destination must differ from the installed package');
  await mkdir(destination, { recursive: true });
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  for (const entry of ['src', 'runtime', 'LICENSE', 'NOTICE.md', 'upstream.json', 'package.json'])
    await cp(join(source, entry), join(destination, entry), { recursive: true, dereference: true });
  // Validate resolution from the output, never accidentally use the developer's install.
  const resolved = createRequire(join(resolve(functionDirectory), 'handler.mjs')).resolve('@lofcz/tikz/package.json');
  if (await realpath(dirname(resolved)) !== await realpath(destination))
    throw new Error('TikZ resolves outside the deployment artifact');
  return { directory: destination, version: manifest.version };
}

/** Produce ordinary static assets; no backend endpoint or special HTTP encoding. */
export async function copyTikzBrowserAssets(directory) {
  const source = dirname(createRequire(import.meta.url).resolve('@lofcz/tikz/package.json'));
  const destination = resolve(directory);
  if (destination === source || destination.startsWith(source + '/'))
    throw new Error('TikZ browser assets must be outside the installed package');
  await mkdir(join(destination, 'src'), { recursive: true });
  await cp(join(source, 'runtime'), join(destination, 'runtime'), { recursive: true });
  for (const name of ['browser.js', 'browser-worker.js'])
    await cp(join(source, 'src', name), join(destination, 'src', name));
  for (const name of ['LICENSE', 'NOTICE.md', 'upstream.json'])
    await cp(join(source, name), join(destination, name));
  const pin = JSON.parse(await readFile(join(source, 'upstream.json'), 'utf8'));
  for (const name of pin.bundles) {
    const base = join(destination, 'runtime/dist/bundles', name);
    const index = JSON.parse(await readFile(join(base, 'files.index.json'), 'utf8'));
    const bytes = brotliDecompressSync(await readFile(join(base, 'files.br')));
    for (const [path, [offset, size]] of Object.entries(index)) {
      const file = join(base, 'files', path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes.subarray(offset, offset + size));
    }
    await rm(join(base, 'files.br')); await rm(join(base, 'files.index.json'));
  }
  return { directory: destination, version: JSON.parse(await readFile(join(source, 'package.json'), 'utf8')).version };
}
