/** Include the full package in a standalone Node function's node_modules. */
export declare function copyTikzAssets(functionDirectory: string): Promise<{ directory: string; version: string }>;

/** Copy worker, WASM, licenses and expanded TeX bundles to a static directory. */
export declare function copyTikzBrowserAssets(directory: string): Promise<{ directory: string; version: string }>;
