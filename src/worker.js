// A separate process makes synchronous TeX loops terminable. The Emscripten
// filesystem is in-memory; no host texmf tree, shell or caller environment.
import { readFileSync } from 'node:fs';
import { MetaPost } from '../runtime/dist/index.js';
import { prepareTikzSource } from './source.js';
const { source } = JSON.parse(readFileSync(0, 'utf8'));
const engine = await MetaPost.create({ worker: false, lazy: true, logLevel: 'silent' });
try {
  const result = await engine.latex(prepareTikzSource(source), { engine: 'auto', fonts: 'paths' });
  if (result.status === 'error' || result.status === 'fatal' || result.pages?.length !== 1)
    throw new Error('TikZ requires one valid page. ' + JSON.stringify(result.diagnostics).slice(0, 2000));
  process.stdout.write(result.pages[0]);
} catch (error) {
  process.stderr.write(String(error).slice(0, 3000));
  process.exitCode = 1;
} finally { engine.dispose(); }
