import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createTex from '../dist/tex.mjs';

const output = [];
const engine = await createTex({
  noInitialRun: true,
  thisProgram: '/work/pdftex',
  print: line => output.push(line),
  printErr: line => output.push(line),
});
engine.FS.mkdir('/work');
engine.FS.chdir('/work');
engine.FS.writeFile('/work/pdftex', '');
engine.ENV.TEXMFCNF = '/work';
engine.FS.writeFile('/work/texmf.cnf', 'TEXINPUTS = .\nmax_print_line = 1000\n');
engine.FS.writeFile('/work/input.txt', 'abc');
engine.FS.writeFile('/work/probe.tex', await readFile(new URL('../test/c23-primitives.tex', import.meta.url)));
engine.callMain(['-ini', '-interaction=nonstopmode', '-halt-on-error', 'probe.tex']);
const log = output.join('\n');
for (const expected of [
  'C23-MD5-TEXT:900150983CD24FB0D6963F7D28E17F72',
  'C23-MD5-FILE:900150983CD24FB0D6963F7D28E17F72',
  'C23-MATCH-SENSITIVE:0', 'C23-MATCH-INSENSITIVE:1',
  'C23-PAGE-STACK:OK', 'C23-STACK:OK',
]) assert.ok(log.includes(expected), `Missing ${expected}:\n${log}`);
console.log('PASS WASM pdfTeX: string/file MD5, case-sensitive/insensitive matching, ordinary/page color stacks');
