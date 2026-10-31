import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { copyTikzBrowserAssets } from '../src/deploy.js';

const root = await mkdtemp(join(tmpdir(), 'tikz-browser-'));
await copyTikzBrowserAssets(root);
const requests = [];
const server = createServer(async (req, res) => {
  requests.push(req.url);
  const path = resolve(root, '.' + new URL(req.url, 'http://local').pathname);
  if (!path.startsWith(root + '/')) { res.end('<!doctype html><title>TikZ browser verification</title>'); return; }
  try {
    const bytes = await readFile(path);
    const type = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' }[extname(path)];
    res.writeHead(200, { 'Content-Type': type ?? 'application/octet-stream', 'Cache-Control': 'public,max-age=3600' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { createTikzRenderer } = await import('/src/browser.js');
    const renderer = createTikzRenderer({ assetBaseUrl: '/', timeoutMs: 30_000 });
    let ticks = 0; const timer = setInterval(() => ticks++, 10);
    const source = String.raw`\begin{tikzpicture}\draw[blue,thick] (0,0) circle (1);\node at (0,0) {$\frac{1}{2}$};\end{tikzpicture}`;
    const image = await renderer.render(source);
    const plot = await renderer.render(String.raw`\documentclass[tikz]{standalone}
\usepackage{pgfplots}\pgfplotsset{compat=1.18}\begin{document}
\begin{tikzpicture}\begin{axis}[width=6cm,height=4cm]\addplot[domain=-2:2] {x^2};\end{axis}\end{tikzpicture}\end{document}`);
    const bad = await renderer.render(String.raw`\begin{tikzpicture}\notACommand\end{tikzpicture}`).then(() => false, () => true);
    const recovered = await renderer.render(source);
    const active = new AbortController();
    const canceled = renderer.render(String.raw`\documentclass{article}\begin{document}\loop\iftrue\repeat\end{document}`, { signal: active.signal }).then(() => false, e => e.name === 'AbortError');
    setTimeout(() => active.abort(), 150);
    const abortOk = await canceled;
    renderer.dispose();
    const limited = createTikzRenderer({ assetBaseUrl: '/', timeoutMs: 300, maxQueue: 0 });
    const timeout = limited.render(String.raw`\documentclass{article}\begin{document}\loop\iftrue\repeat\end{document}`).then(() => false, e => /timed out/.test(e.message));
    const queue = await limited.render(source).then(() => false, e => /busy/.test(e.message));
    const timeoutOk = await timeout; limited.dispose(); clearInterval(timer);
    const img = document.createElement('img'); img.src = image.dataUrl; document.body.append(img); await img.decode();
    return { width: image.width, height: image.height, plot: plot.width, recovered: recovered.width, bad, abortOk, timeoutOk, queue, ticks, naturalWidth: img.naturalWidth };
  });
  assert(result.width > 0 && result.height > 0 && result.plot > 0 && result.recovered > 0 && result.naturalWidth > 0);
  for (const key of ['bad','abortOk','timeoutOk','queue']) assert(result[key], key);
  assert(result.ticks > 10, 'UI thread stayed responsive');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert(!requests.some(url => url.includes('render-tikz') || url.includes('/api/')));
  console.log('PASS real browser WASM, pgfplots, image decoding, recovery, abort, timeout, queue and responsive UI', result);
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); await rm(root, { recursive: true, force: true }); }
