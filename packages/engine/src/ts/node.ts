/** Node bundle I/O, including the fork's compact server distribution. */
import type { BundleIO } from './vfs/bundle.js';

export async function nodeIO(): Promise<BundleIO> {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { sep, join } = await import('node:path');
  const { brotliDecompressSync } = await import('node:zlib');
  const strip = (u: string) => u.startsWith('file://')
    ? fileURLToPath(new URL(u)) : u.replace(/\?v=[0-9a-f]+$/, '');
  const bundles = new Map<string, { bytes: Buffer; index: Record<string, [number, number]> }>();
  const read = (url: string): Uint8Array => {
    const path = strip(url);
    try { return fs.readFileSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // Bundle archives preserve cross-file compression (especially fonts).
      // Cache only bundles touched by this engine instance; raw files override.
      const marker = `${sep}files${sep}`;
      const position = path.lastIndexOf(marker);
      if (position < 0) throw error;
      const directory = path.slice(0, position);
      let bundle = bundles.get(directory);
      if (!bundle) {
        bundle = {
          bytes: brotliDecompressSync(fs.readFileSync(join(directory, 'files.br'))),
          index: JSON.parse(fs.readFileSync(join(directory, 'files.index.json'), 'utf8')),
        };
        bundles.set(directory, bundle);
      }
      const key = path.slice(position + marker.length).split(sep).join('/');
      const entry = Object.hasOwn(bundle.index, key) ? bundle.index[key] : undefined;
      if (!entry) throw error;
      const [offset, size] = entry;
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bundle.bytes.length)
        throw new Error(`Invalid bundle offset: ${key}`);
      return bundle.bytes.subarray(offset, offset + size);
    }
  };
  return {
    async fetch(url) { return read(url); },
    fetchSync: read,
    async fetchJson(url) { return JSON.parse(fs.readFileSync(strip(url), 'utf8')); },
  };
}

export const isNode = typeof process !== 'undefined' && !!(process as any).versions?.node && typeof (globalThis as any).window === 'undefined';
