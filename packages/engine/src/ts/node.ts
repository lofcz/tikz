/** Node bundle I/O, including the fork's compact server distribution. */
import type { BundleIO } from './vfs/bundle.js';

export async function nodeIO(): Promise<BundleIO> {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { sep, join } = await import('node:path');
  const { brotliDecompressSync } = await import('node:zlib');
  const strip = (u: string) => u.startsWith('file://')
    ? fileURLToPath(new URL(u)) : u.replace(/\?v=[0-9a-f]+$/, '');
  type Entry = [number, number] | [string, number, number];
  const layouts = new Map<string, { index: Record<string, Entry>; chunks: Map<string, Buffer> }>();
  const explicit = new Set<string>();
  function packed(directory: string, key: string): Uint8Array {
    let layout = layouts.get(directory);
    if (!layout) {
      layout = { index: JSON.parse(fs.readFileSync(join(directory, 'files.index.json'), 'utf8')), chunks: new Map() };
      layouts.set(directory, layout);
    }
    const entry = Object.hasOwn(layout.index, key) ? layout.index[key] : undefined;
    if (!entry) throw Object.assign(new Error(`Missing bundle file: ${key}`), { code: 'ENOENT' });
    const [chunk, offset, size] = entry.length === 2 ? ['files.br', ...entry] as [string, number, number] : entry;
    if (!/^(files\.br|chunks\/[0-9]+\.br)$/.test(chunk)) throw new Error('Invalid bundle chunk');
    let bytes = layout.chunks.get(chunk);
    if (!bytes) { bytes = brotliDecompressSync(fs.readFileSync(join(directory, chunk))); layout.chunks.set(chunk, bytes); }
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length)
      throw new Error(`Invalid bundle offset: ${key}`);
    return bytes.subarray(offset, offset + size);
  }
  const read = (url: string): Uint8Array => {
    const path = strip(url);
    const marker = `${sep}files${sep}`;
    const position = path.lastIndexOf(marker);
    const directory = path.slice(0, position);
    const key = path.slice(position + marker.length).split(sep).join('/');
    // New manifests explicitly select packed storage: no speculative filesystem
    // calls or ENOENT exceptions for each file. Legacy/raw layouts retain overrides.
    if (position >= 0 && explicit.has(directory)) return packed(directory, key);
    try { return fs.readFileSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || position < 0) throw error;
      return packed(directory, key);
    }
  };
  return {
    async fetch(url) { return read(url); },
    fetchSync: read,
    async fetchJson(url) {
      const path = strip(url);
      const json = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (path.endsWith(`${sep}manifest.json`) && json.storage === 'brotli-chunks-v1')
        explicit.add(path.slice(0, -'/manifest.json'.length));
      return json;
    },
  };
}

export const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node && typeof (globalThis as any).window === 'undefined';
