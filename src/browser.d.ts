import type { TikzImage, TikzRenderOptions } from './index.js';
export declare const TIKZ_MAX_SOURCE: 12000;
export interface BrowserTikzRendererOptions {
  /** Same-origin URL ending in /, populated with copyTikzBrowserAssets. */
  assetBaseUrl: string | URL;
  /** Compilation deadline, default 30000 ms. */
  timeoutMs?: number;
  /** Initial worker/runtime loading deadline, default 60000 ms. */
  loadTimeoutMs?: number;
  maxQueue?: number;
  maxSourceLength?: number;
  maxOutputBytes?: number;
}
export interface BrowserTikzRenderer {
  render(source: string, options?: TikzRenderOptions): Promise<TikzImage>;
  dispose(): void;
}
export declare function createTikzRenderer(options: BrowserTikzRendererOptions): BrowserTikzRenderer;
