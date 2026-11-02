import { MetaPost } from '../runtime/dist/index.js';
import { prepareTikzSource } from './source.js';

try {
  const engine = await MetaPost.create({ worker: false, lazy: true, snapshot: 'auto', logLevel: 'silent' });
  self.onmessage = async ({ data: { source: code, maxOutputBytes } }) => {
    try {
      const result = await engine.latex(prepareTikzSource(code), { engine: 'auto', fonts: 'paths' });
      if (result.status === 'error' || result.status === 'fatal' || result.pages?.length !== 1)
        throw new Error('TikZ requires one valid page. ' + JSON.stringify(result.diagnostics).slice(0, 2000));
      const svg = result.pages[0], bytes = new TextEncoder().encode(svg);
      if (bytes.length > maxOutputBytes) throw new Error('TikZ output too large; simplify the picture.');
      const dimensions = svg.match(/viewBox=['"]([^'"]+)['"]/)?.[1].trim().split(/[ ,]+/).map(Number);
      if (!dimensions || dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2] <= 0 || dimensions[3] <= 0)
        throw new Error('TikZ returned an invalid picture size');
      let binary = '';
      for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      self.postMessage({ image: { svg, width: dimensions[2], height: dimensions[3], dataUrl: `data:image/svg+xml;base64,${btoa(binary)}` } });
    } catch (error) { self.postMessage({ error: String(error).slice(0, 3000) }); }
  };
  self.postMessage({ ready: true });
} catch (error) { self.postMessage({ error: String(error).slice(0, 3000) }); }
