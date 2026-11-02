// A separate process makes synchronous TeX loops terminable. The Emscripten
// filesystem is in-memory; no host texmf tree, shell or caller environment.
import { readFileSync } from 'node:fs';
import { MetaPost } from '../runtime/dist/index.js';
import { describeTikzFailure, prepareTikzDocument } from './source.js';
const { source } = JSON.parse(readFileSync(0, 'utf8'));
let engine;
try {
  const prepared = prepareTikzDocument(source);
  engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent' });
  const result = await engine.latex(prepared.source, { engine: 'auto', fonts: 'paths' });
  if (result.status === 'error' || result.status === 'fatal' || result.pages?.length !== 1)
    throw new Error(describeTikzFailure(result, prepared));
  process.stdout.write(result.pages[0]);
} catch (error) {
  process.stderr.write(String(error?.message ?? error).slice(0, 3000));
  process.exitCode = 1;
} finally { engine?.dispose(); }
