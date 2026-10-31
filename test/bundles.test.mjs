import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import test from 'node:test';
import { nodeIO } from '../runtime/dist/node.js';

test('every shipped bundle file retains its manifest bytes and hash', async () => {
  const pin = JSON.parse(await readFile(new URL('../upstream.json', import.meta.url)));
  const io = await nodeIO();
  let count = 0;
  for (const bundle of pin.bundles) {
    const base = new URL(`../runtime/dist/bundles/${bundle}/`, import.meta.url);
    const manifest = await io.fetchJson(new URL('manifest.json', base).href);
    for (const [path, expected] of Object.entries(manifest.files)) {
      const bytes = io.fetchSync(new URL(`files/${path}?v=${expected.sha}`, base).href);
      assert.equal(bytes.length, expected.size, path);
      assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, expected.sha.length), expected.sha, path);
      count++;
    }
  }
  assert(count > 3000);
});

test('Node I/O accepts file URLs with spaces, compression and raw overrides', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikz io '));
  try {
    await mkdir(join(dir, 'files'));
    const path = join(dir, 'files', 'a # unicode č.tex');
    const io = await nodeIO();
    const url = pathToFileURL(path); url.search = '?v=abcdef';
    await writeFile(join(dir, 'files.br'), brotliCompressSync(Buffer.from('compressed')));
    await writeFile(join(dir, 'files.index.json'), JSON.stringify({ 'a # unicode č.tex': [0, 10] }));
    assert.equal(Buffer.from(await io.fetch(url.href)).toString(), 'compressed');
    await writeFile(path, 'raw override');
    assert.equal(Buffer.from(io.fetchSync(url.href)).toString(), 'raw override');
    await rm(path); await writeFile(join(dir, 'files.br'), 'corrupt');
    const fresh = await nodeIO();
    await assert.rejects(fresh.fetch(url.href));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
