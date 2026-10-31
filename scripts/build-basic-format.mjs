// Build data with the exact pinned WASM and macro files; no host TeX or downloads.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function buildBasicFormat(runtime, names) {
  const dist = join(runtime, 'dist');
  const { BundleSet } = await import(pathToFileURL(join(dist, 'vfs/bundle.js')));
  const { nodeIO } = await import(pathToFileURL(join(dist, 'node.js')));
  const { runTex } = await import(pathToFileURL(join(dist, 'texengine.js')));
  const { default: createTex } = await import(pathToFileURL(join(dist, 'tex.mjs')));
  const bundles = new BundleSet(await nodeIO());
  await bundles.addAll(names.map(name => ({ name, manifestUrl: pathToFileURL(join(dist, 'bundles', name)).href })));
  const source = await readFile(new URL('../packages/engine/bundles/tex/tikz-basic-snapshot.tex', import.meta.url), 'utf8');
  let bytes;
  // -etex would start virgin INITEX and prevent loading &latex. The existing
  // latex format already enables e-TeX and contains cp227 and Unicode tables.
  const result = await runTex(createTex, {
    args: ['-ini', '-jobname=tikz-basic', '-progname=latex', '-interaction=nonstopmode', '-halt-on-error', '&latex', 'tikz-basic.tex'],
    setup(M) {
      bundles.install(M.FS);
      M.FS.mkdir('/work'); M.FS.chdir('/work');
      M.FS.writeFile('/work/tikz-basic.tex', source);
    },
    collect(M) {
      try { bytes = M.FS.readFile('/work/tikz-basic.fmt', { encoding: 'binary' }); } catch {}
    },
  });
  if (result.exitCode !== 0 || !bytes?.length) throw new Error(`Basic TikZ format failed:\n${result.log}`);
  const directory = join(dist, 'bundles/tikz-snapshot');
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  await mkdir(join(directory, 'files/web2c'), { recursive: true });
  await writeFile(join(directory, 'files/web2c/tikz-basic.fmt'), bytes);
  manifest.files['web2c/tikz-basic.fmt'] = { size: bytes.length, sha: createHash('sha256').update(bytes).digest('hex') };
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Built tikz-basic.fmt: ${bytes.length} bytes (full: ${manifest.files['web2c/tikz.fmt'].size})`);
}
