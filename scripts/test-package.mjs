import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'tikz-package-test-'));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error}\n${result.stdout}`);
  return result.stdout;
}
try {
  const [pack] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root));
  assert(pack.files.some(file => file.path === 'runtime/dist/tex.wasm'));
  assert(!pack.files.some(file => /bundles\/(classico|ghostscript|opentype|latex-doc)\//.test(file.path)));
  assert(!pack.files.some(file => file.path.split('/').some(part => part.startsWith('._'))));
  const consumer = join(temp, 'consumer'), deployed = join(temp, 'function');
  await mkdir(consumer); await mkdir(deployed);
  await writeFile(join(consumer, 'package.json'), '{"type":"module","private":true}');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', join(temp, pack.filename)], consumer);
  await writeFile(join(consumer, 'deploy.mjs'), `import {copyTikzAssets} from '@lofcz/tikz/deploy'; await copyTikzAssets(${JSON.stringify(deployed)});`);
  run(process.execPath, ['deploy.mjs'], consumer);
  // Simulate a bundler relocating our entry into the function's code. Asset
  // lookup must resolve its local package, not use import.meta.url-relative WASM.
  await cp(join(consumer, 'node_modules/@lofcz/tikz/src/index.js'), join(deployed, 'bundled-entry.mjs'));
  await rm(consumer, { recursive: true, force: true });
  await writeFile(join(deployed, 'test.mjs'), String.raw`import {renderTikz} from './bundled-entry.mjs';
const result=await renderTikz(String.raw\`\begin{tikzpicture}\draw (0,0)--(2,1);\end{tikzpicture}\`);
if (!(result.width > 0 && result.svg.includes('<svg'))) throw new Error('Invalid render');
console.log('PASS offline installed tarball and relocated deployment render');`.replaceAll('\\`','`'));
  console.log(run(process.execPath, ['test.mjs'], deployed).trim());
  console.log(`Packed ${(pack.size / 1048576).toFixed(1)} MB; unpacked ${(pack.unpackedSize / 1048576).toFixed(1)} MB`);
} finally { await rm(temp, { recursive: true, force: true }); }
