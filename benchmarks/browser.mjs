import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { fixtures } from './fixtures.mjs';
const roots = process.argv.slice(2);
assert.equal(roots.length, 2, 'Pass baseline and candidate package roots');
const directory = await mkdtemp(join(tmpdir(), 'tikz-browser-bench-'));
for (const [i, root] of roots.entries()) {
  const { copyTikzBrowserAssets } = await import(pathToFileURL(resolve(root, 'src/deploy.js')));
  await copyTikzBrowserAssets(join(directory, String(i)));
}
let traffic = [];
const latency = Number(process.env.BENCH_HTTP_LATENCY_MS ?? 0);
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.end('<!doctype html><title>Cold TikZ benchmark</title>'); return; }
  const pathname = new URL(req.url, 'http://local').pathname;
  const file = resolve(directory, '.' + pathname);
  if (!file.startsWith(directory + '/')) { res.writeHead(403); res.end(); return; }
  try {
    const bytes = await readFile(file); traffic.push({ path: pathname, bytes: bytes.length });
    if (latency) await new Promise(r => setTimeout(r, latency));
    res.writeHead(200, { 'Content-Type': { '.js':'text/javascript', '.mjs':'text/javascript', '.wasm':'application/wasm', '.json':'application/json' }[extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const fixture of ['simple','plot']) for (let round=0; round<Number(process.env.BENCH_ROUNDS ?? 3); round++) {
    for (const variant of round % 2 ? [1,0] : [0,1]) {
      const context = await browser.newContext(); const page = await context.newPage();
      await page.goto(origin); traffic = [];
      const result = await page.evaluate(async ({ variant, source }) => {
        const { createTikzRenderer } = await import(`/${variant}/src/browser.js`);
        const start = performance.now();
        const renderer = createTikzRenderer({ assetBaseUrl: `/${variant}/` });
        try { const { svg } = await renderer.render(source); return { ms: performance.now()-start, svg }; }
        finally { renderer.dispose(); }
      }, { variant, source: fixtures[fixture] });
      results.push({ fixture, round, variant, ms: result.ms, requests: traffic.length,
        bytes: traffic.reduce((sum,r)=>sum+r.bytes,0), sha: createHash('sha256').update(result.svg).digest('hex'),
        formats: traffic.filter(r=>r.path.endsWith('.fmt')).map(r=>r.path) });
      await context.close();
    }
  }
  for (const fixture of ['simple','plot']) {
    assert.equal(new Set(results.filter(r=>r.fixture===fixture).map(r=>r.sha)).size, 1, fixture+' SVG changed');
    for (const variant of [0,1]) {
      const rows=results.filter(r=>r.fixture===fixture && r.variant===variant);
      const median=k=>rows.map(r=>r[k]).sort((a,b)=>a-b)[Math.floor(rows.length/2)];
      console.log(JSON.stringify({fixture,variant,ms:median('ms'),requests:median('requests'),bytes:median('bytes')}));
    }
  }
  if (process.env.BENCH_BROWSER_OUTPUT) await writeFile(process.env.BENCH_BROWSER_OUTPUT, JSON.stringify({latency,roots,results},null,2));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r=>server.close(r)); await rm(directory,{recursive:true,force:true}); }
