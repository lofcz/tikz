import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { x } from 'tar';
const root = fileURLToPath(new URL('../', import.meta.url));
const pin = JSON.parse(await readFile(join(root, 'upstream.json'), 'utf8'));
const target = join(root, 'runtime');
try {
  const installed = JSON.parse(await readFile(join(target, 'upstream.json'), 'utf8'));
  if (JSON.stringify(installed) === JSON.stringify(pin)) {
    await access(join(target, 'dist/tex.wasm'));
    await access(join(target, 'dist/index.js'));
    console.log(`mp-tikz-wasm ${pin.version} ready`);
    process.exit(0);
  }
} catch {}
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
