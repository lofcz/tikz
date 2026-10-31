import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const TIKZ_MAX_SOURCE = 12_000;
const packageRoot = () => dirname(createRequire(import.meta.url).resolve('@lofcz/tikz/package.json'));
const abortError = () => new DOMException('TikZ rendering aborted', 'AbortError');
const busyError = () => new Error('TikZ renderer busy; retry shortly.');

/** @param {import('./index.js').TikzRendererOptions} [options] */
export function createTikzRenderer(options = {}) {
  const settings = {
    concurrency: 2, maxQueue: 8, timeoutMs: 30_000,
    maxSourceLength: TIKZ_MAX_SOURCE, maxOutputBytes: 4_000_000,
    nodeExecutable: process.versions.bun ? 'node' : process.execPath,
    ...options,
  };
  for (const name of ['concurrency', 'maxQueue', 'timeoutMs', 'maxSourceLength', 'maxOutputBytes']) {
    if (!Number.isSafeInteger(settings[name]) || settings[name] < (name === 'maxQueue' ? 0 : 1))
      throw new TypeError(`Invalid TikZ ${name}`);
  }
  if (typeof settings.nodeExecutable !== 'string' || !settings.nodeExecutable)
    throw new TypeError('Invalid TikZ nodeExecutable');
  let active = 0;
  const queue = [];
  function release() {
    const next = queue.shift();
    if (next) next.ready();
    else active--;
  }
  async function acquire(signal) {
    if (signal?.aborted) throw abortError();
    if (active < settings.concurrency) { active++; return; }
    if (queue.length >= settings.maxQueue) throw busyError();
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); };
      const remove = (error) => {
        const index = queue.indexOf(entry);
        if (index >= 0) queue.splice(index, 1);
        cleanup(); reject(error);
      };
      const aborted = () => remove(abortError());
      const entry = { ready() { cleanup(); resolve(); } };
      const timer = setTimeout(() => remove(busyError()), settings.timeoutMs);
      signal?.addEventListener('abort', aborted, { once: true });
      queue.push(entry);
    });
  }
  function compile(source, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(abortError()); return; }
      const root = packageRoot();
      const child = spawn(settings.nodeExecutable, ['--max-old-space-size=512', join(root, 'src/worker.js')], {
        env: {}, cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
      });
      const chunks = [];
      let bytes = 0, stderr = '', failure;
      // Keep the semaphore slot until close confirms the killed process is gone.
      const fail = (error) => { failure ??= error; child.kill('SIGKILL'); };
      const aborted = () => fail(abortError());
      const timer = setTimeout(() => fail(new Error(`TikZ exceeded ${settings.timeoutMs}ms; simplify or split the picture.`)), settings.timeoutMs);
      signal?.addEventListener('abort', aborted, { once: true });
      child.stdout.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > settings.maxOutputBytes) fail(new Error('TikZ output too large; simplify the picture.'));
        else chunks.push(chunk);
      });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
      child.on('error', error => { failure ??= error; });
      child.stdin.on('error', () => {});
      child.on('close', (code, terminationSignal) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', aborted);
        if (failure) { reject(failure); return; }
        if (code !== 0 || terminationSignal) { reject(new Error(stderr || 'TikZ compilation failed')); return; }
        try {
          const { svg } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const dimensions = typeof svg === 'string' && svg.match(/viewBox=['"]([^'"]+)['"]/)?.[1].trim().split(/[ ,]+/).map(Number);
          if (!dimensions || dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2] <= 0 || dimensions[3] <= 0)
            throw new Error('TikZ returned an invalid picture size');
          resolve({ svg, width: dimensions[2], height: dimensions[3], dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
        } catch (error) { reject(error); }
      });
      child.stdin.end(JSON.stringify({ source }));
    });
  }
  return {
    async render(code, { signal } = {}) {
      if (typeof code !== 'string' || !code.trim() || code.length > settings.maxSourceLength)
        throw new Error(`TikZ: use 1–${settings.maxSourceLength.toLocaleString('en-US')} characters.`);
      const source = /^\s*\\documentclass\b/m.test(code) ? code : String.raw`\documentclass[tikz,border=6pt]{standalone}
\usetikzlibrary{calc,intersections,angles,quotes,arrows.meta,positioning}
\begin{document}
${code}
\end{document}`;
      await acquire(signal);
      try { return await compile(source, signal); }
      finally { release(); }
    },
  };
}
const defaultRenderer = createTikzRenderer();
export const renderTikz = (source, options) => defaultRenderer.render(source, options);
