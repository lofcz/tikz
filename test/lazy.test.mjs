import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaPost } from '../runtime/dist/index.js';

const document = String.raw`\documentclass[tikz]{standalone}\begin{document}\begin{tikzpicture}\draw (0,0)--(2,1);\end{tikzpicture}\end{document}`;
test('TikZ never initializes MetaPost, including files added before compilation', async () => {
  let mplib = 0;
  const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent', modules: {
    mplib: async () => { mplib++; throw new Error('MetaPost deliberately unavailable'); },
  } });
  try {
    assert.equal(mplib, 0);
    await engine.addFiles({ 'figure.tex': String.raw`\draw (0,0)--(2,1);` });
    const result = await engine.latex(document.replace(String.raw`\draw (0,0)--(2,1);`, String.raw`\input{figure.tex}`));
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.equal(mplib, 0);
    await engine.removeFiles();
    const missing = await engine.latex(document.replace(String.raw`\draw (0,0)--(2,1);`, String.raw`\input{figure.tex}`));
    assert.equal(missing.status, 'error');
    assert.equal(mplib, 0);
    await assert.rejects(engine.run('beginfig(1); draw origin--(10,10); endfig;'), /deliberately unavailable/);
    assert.equal(mplib, 1);
  } finally { engine.dispose(); }
});

test('lazy mode preserves real MetaPost and pending user files', async () => {
  const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent' });
  try {
    await engine.addFiles({ 'figure.mp': 'draw origin--(20,10);' });
    const result = await engine.run('beginfig(1); input figure; endfig;');
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert(result.figures.length > 0);
    const image = await engine.latex(document);
    assert.equal(image.status, 'ok');
  } finally { engine.dispose(); }
});
