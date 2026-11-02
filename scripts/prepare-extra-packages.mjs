// TeX Live 2025 matches the pinned engine format. Archives are checksum-pinned;
// only TeX runtime files are exposed, and the engine fetches them lazily.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp, rm, readdir, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { x } from 'tar';

export async function prepareExtraPackages(root, target) {
  const packages = JSON.parse(await readFile(join(root, 'scripts/data/extra-packages.json'), 'utf8'));
  const directory = join(target, 'dist/bundles/tikz-extra');
  const key = createHash('sha256').update(JSON.stringify(packages)).digest('hex');
  try { if ((await readFile(join(directory, '.packages-key'), 'utf8')) === key) return; } catch {}
  const staged = await mkdtemp(join(tmpdir(), 'tikz-extra-'));
  try {
    const files = join(staged, 'files');
    await mkdir(files);
    for (const pkg of packages) {
      const archivePath = join(root, 'scripts/data/texlive', `${pkg.name}.tar.xz`);
      let archive;
      try { archive = await readFile(archivePath); } catch {
        const response = await fetch(pkg.url, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`${pkg.name}: archive HTTP ${response.status}`);
        archive = Buffer.from(await response.arrayBuffer());
      }
      if (createHash('sha256').update(archive).digest('hex') !== pkg.sha256) throw new Error(`${pkg.name}: archive checksum mismatch`);
      await mkdir(dirname(archivePath), { recursive: true });
      await writeFile(archivePath, archive);
      const tar = join(staged, `${pkg.name}.tar`);
      await writeFile(tar, execFileSync('xz', ['-dc', archivePath], { maxBuffer: 32 * 1024 * 1024 }));
      await x({ file: tar, cwd: files, strict: true, filter: (path, entry) =>
        !['SymbolicLink', 'Link'].includes(entry.type) && /^(tex|fonts)\//.test(path) && !path.split('/').includes('..') });
    }
    const manifest = { name: 'tikz-extra', version: key.slice(0, 16), texlive: '2025', files: {}, dirs: [] };
    async function index(directory, prefix = '') {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const path = prefix + entry.name;
        if (entry.isDirectory()) { manifest.dirs.push(path); await index(join(directory, entry.name), path + '/'); }
        else {
          const bytes = await readFile(join(directory, entry.name));
          manifest.files[path] = { size: bytes.length, sha: createHash('sha256').update(bytes).digest('hex').slice(0, 16) };
        }
      }
    }
    await index(files);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    await cp(files, join(directory, 'files'), { recursive: true });
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(directory, '.packages-key'), key);
    console.log(`Prepared ${packages.length} extra TeX packages (${Object.keys(manifest.files).length} files), loaded on demand`);
  } finally { await rm(staged, { recursive: true, force: true }); }
}
