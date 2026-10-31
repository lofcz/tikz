import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { nodeIO } from '../runtime/dist/node.js';
import { BundleSet } from '../runtime/dist/vfs/bundle.js';

test('explicit chunks avoid raw-file probes and never decompress unused chunks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikz chunks '));
  const original = fs.readFileSync;
  const reads = [];
  try {
    await mkdir(join(dir, 'chunks'));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ storage: 'brotli-chunks-v1' }));
    await writeFile(join(dir, 'files.index.json'), JSON.stringify({
      'one.tex': ['chunks/0.br', 0, 3], 'two.tex': ['chunks/0.br', 3, 3], 'bad.tex': ['chunks/1.br', 0, 5],
    }));
    await writeFile(join(dir, 'chunks/0.br'), brotliCompressSync(Buffer.from('onetwo')));
    await writeFile(join(dir, 'chunks/1.br'), 'invalid compression');
    fs.readFileSync = function(path, ...args) { reads.push(String(path)); return original.call(this, path, ...args); };
    syncBuiltinESMExports();
    const io = await nodeIO();
    await io.fetchJson(pathToFileURL(join(dir, 'manifest.json')).href);
    for (const name of ['one', 'two']) assert.equal(Buffer.from(await io.fetch(pathToFileURL(join(dir, 'files', `${name}.tex`)).href)).toString(), name);
    assert.equal(reads.filter(p => p.includes('/files/')).length, 0);
    assert.equal(reads.filter(p => p.endsWith('/chunks/0.br')).length, 1);
    assert(!reads.some(p => p.endsWith('/chunks/1.br')));
    await assert.rejects(io.fetch(pathToFileURL(join(dir, 'files/bad.tex')).href));
    await assert.rejects(io.fetch(pathToFileURL(join(dir, 'files/missing.tex')).href), { code: 'ENOENT' });
  } finally {
    fs.readFileSync = original; syncBuiltinESMExports();
    await rm(dir, { recursive: true, force: true });
  }
});

test('prebuilt filesystem indexes invalidate when bundles are added', async () => {
  const a = { name: 'a', filesystemKey: 'a1', files: { 'tex/a.tex': { size: 1 } } };
  const b = { name: 'b', filesystemKey: 'b1', files: { 'tex/b.tex': { size: 1 } } };
  const json = { 'a/manifest.json': a, 'b/manifest.json': b };
  const io = { fetchJson: async url => json[url], fetch: async () => new Uint8Array([1]) };
  const builder = new BundleSet(io); await builder.add({ name: 'a', manifestUrl: 'a' });
  json.index = builder.exportFilesystemIndex();
  const loaded = new BundleSet(io); await loaded.add({ name: 'a', manifestUrl: 'a' });
  await loaded.loadFilesystemIndex('index');
  const written = [];
  const fs = { analyzePath: () => ({ exists: true }), lookupPath: () => ({ node: { node_ops: {} } }), writeFile: (_, data) => written.push(data) };
  loaded.install(fs, '/texmf');
  assert(written.at(-1).includes('a.tex')); assert(!written.at(-1).includes('b.tex'));
  await loaded.add({ name: 'b', manifestUrl: 'b' });
  await loaded.loadFilesystemIndex('index'); // stale keys must not replace the extended tree
  loaded.install(fs, '/texmf');
  assert(written.at(-1).includes('a.tex')); assert(written.at(-1).includes('b.tex'));
});

test('legacy archives retain raw-file overrides and reject invalid index entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikz legacy '));
  try {
    await mkdir(join(dir, 'files'));
    await writeFile(join(dir, 'files/override.tex'), 'raw');
    await writeFile(join(dir, 'files.br'), brotliCompressSync(Buffer.from('archive')));
    await writeFile(join(dir, 'files.index.json'), JSON.stringify({
      'override.tex': [0, 7], 'legacy.tex': [0, 7], 'bounds.tex': [5, 7],
      'traversal.tex': ['../outside.br', 0, 7],
    }));
    const io = await nodeIO();
    const read = name => io.fetch(pathToFileURL(join(dir, 'files', name)).href);
    assert.equal(Buffer.from(await read('override.tex')).toString(), 'raw');
    assert.equal(Buffer.from(await read('legacy.tex')).toString(), 'archive');
    await assert.rejects(read('bounds.tex'), /Invalid bundle offset/);
    await assert.rejects(read('traversal.tex'), /Invalid bundle chunk/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
