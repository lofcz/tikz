import { cp, mkdir, readFile, realpath } from 'node:fs/promises';
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
