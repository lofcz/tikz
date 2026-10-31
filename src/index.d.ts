export interface TikzImage {
  svg: string;
  width: number;
  height: number;
  /** Inert SVG image URL, suitable for an img element. */
  dataUrl: string;
}
export interface TikzRenderOptions { signal?: AbortSignal }
export interface TikzRendererOptions {
  /** Running child processes. Default: 2. */
  concurrency?: number;
  /** Waiting renders; overflow rejects immediately. Default: 8. */
  maxQueue?: number;
  /** Per-render execution deadline, and maximum queue wait. Default: 30000. */
  timeoutMs?: number;
  /** Default: 12000 UTF-16 code units. */
  maxSourceLength?: number;
  /** Default: 4000000 UTF-8 bytes. */
  maxOutputBytes?: number;
  /** Optional Node executable for Bun hosts that do not have node on PATH. */
  nodeExecutable?: string;
}
export interface TikzRenderer {
  render(source: string, options?: TikzRenderOptions): Promise<TikzImage>;
}
export declare const TIKZ_MAX_SOURCE: 12000;
export declare function createTikzRenderer(options?: TikzRendererOptions): TikzRenderer;
export declare function renderTikz(source: string, options?: TikzRenderOptions): Promise<TikzImage>;
