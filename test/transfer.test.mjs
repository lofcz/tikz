import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaPost } from '../runtime/dist/index.js';
import createDvisvgm from '../runtime/dist/dvisvgm.mjs';
import { completedFileBytes, writeDeferredFile, isUnloadedLazy } from '../runtime/dist/vfs/lazyfs.js';

test('completed files avoid copying only outside the WASM heap', () => {
  const heap = new Uint8Array(64), owned = new Uint8Array([1,2,3,4]);
  let reads = 0;
  const node = { contents: owned, usedBytes: 3 };
  const fs = { lookupPath: () => ({ node }), readFile: () => { reads++; return node.contents.slice(0,node.usedBytes); } };
  assert.equal(completedFileBytes(fs, '/doc.dvi', heap).buffer, owned.buffer);
  assert.equal(reads, 0);
  node.contents = heap.subarray(0,4);
  assert.notEqual(completedFileBytes(fs, '/doc.dvi', heap).buffer, heap.buffer);
  assert.equal(reads, 1);
  assert.notEqual(completedFileBytes(fs, '/doc.dvi').buffer, heap.buffer);
});

test('deferred inputs remain available and cannot mutate the caller buffer', async () => {
  const module = await createDvisvgm({ noInitialRun: true, print() {}, printErr() {} });
  const original = new Uint8Array([10,20,30]);
  let loads = 0;
  writeDeferredFile(module.FS, '/work/data.bin', 3, () => { loads++; return original; });
  assert.equal(module.FS.stat('/work/data.bin').size, 3);
  assert.equal(loads, 0);
  assert.deepEqual(module.FS.readFile('/work/data.bin'), original);
  assert.equal(loads, 1);
  const stream = module.FS.open('/work/data.bin', 'r+');
  module.FS.write(stream, new Uint8Array([99]), 0, 1, 0); module.FS.close(stream);
  assert.deepEqual([...original], [10,20,30]);
  assert.equal(module.FS.readFile('/work/data.bin')[0], 99);
});

test('dvisvgm consumes owned DVI and reads generated auxiliary files on demand', async () => {
  const writes = [], reads = [];
  const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent', modules: {
    dvisvgm: async options => {
      const M = await createDvisvgm(options), write = M.FS.writeFile;
      M.FS.writeFile = function(path, data, options) { writes.push({ path, canOwn: options?.canOwn }); return write.call(this, path, data, options); };
      const main = M.callMain;
      M.callMain = args => { const result = main(args);
        reads.push({ mapLoaded: !isUnloadedLazy(M.FS, '/work/generated.map'), unusedLoaded: !isUnloadedLazy(M.FS, '/work/unused.bin') });
        return result; };
      return M;
    },
  } });
  try {
    const source = String.raw`\documentclass[tikz]{standalone}
\begin{filecontents*}{generated.map}
cmr10 CMR10 <cmr10.pfb
\end{filecontents*}
\begin{document}\begin{tikzpicture}\draw (0,0) rectangle (2,1);\node at (1,0.5) {M};\special{dvisvgm:img 10pt 10pt supplied.png}\end{tikzpicture}\end{document}`;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ksAAAAASUVORK5CYII=', 'base64');
    const result = await engine.latex(source, { dvisvgmArgs: ['--fontmap=generated.map', '--embed-bitmaps'], files: {
      'supplied.png': png,
      'unused.bin': new Uint8Array(1024 * 1024),
    } });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    const embedded = /data:image\/png;base64,([^'"]+)/.exec(result.pages[0]);
    assert(embedded, result.dvisvgmLog);
    assert.deepEqual(Buffer.from(embedded[1].replace(/\s/g, ''), 'base64'), png);
    assert.match(new TextDecoder().decode(result.artifacts['generated.map']), /cmr10 CMR10/);
    assert.deepEqual(reads, [{ mapLoaded: true, unusedLoaded: false }]);
    assert(writes.some(x => x.path === '/work/doc.dvi' && x.canOwn));
    for (const path of ['/work/unused.bin','/work/doc.aux','/work/generated.map'])
      assert(!writes.some(x => x.path === path), `${path} copied eagerly`);
  } finally { engine.dispose(); }
});
