# Fresh-render measurements

`node benchmarks/cold.mjs /path/to/baseline /path/to/candidate` alternates three
fresh child processes per fixture and version. It checks identical SVG hashes
for a line with math, a 200-sample pgfplots plot, LuaTeX graph drawing, and a
756-node drawing. Use `BENCH_ROUNDS`, `BENCH_NODE` and `BENCH_OUTPUT` to select
rounds, executable and the JSON report. `BENCH_WRAPPER=1` includes the public
process-isolated API; its RSS and instrumentation cover the parent only, so use
the default direct-engine mode for engine memory/I/O measurements.

`node benchmarks/index.mjs` isolates dynamic versus prebuilt filesystem index
construction, using a new bundle set for every sample. Browser asset generation
removes this prebuilt index to avoid an extra HTTP request.

CI compares the checkout with the fixed published 0.2.1 package on Node 24 and
retains all samples as an artifact. Timings are observations, not flaky pass/fail
thresholds. Local timings under concurrent compiler load are not representative
of Vercel. SVG equality is mandatory.

Initial local measurements (three fresh renders per fixture):

| Fixture | Failed file reads: old → new | Inflated bytes: old → chunks |
| --- | ---: | ---: |
| Line and math | 16 → 0 | 34,955,615 → 11,394,598 |
| pgfplots | 18 → 0 | 34,955,615 → 11,897,960 |
| LuaTeX graph | 155 → 0 | 45,718,821 → 18,925,080 |
| 756-node drawing | 18 → 0 | 34,955,615 → 11,892,765 |

512 KiB chunks trade roughly 1 MiB more compressed package data for substantially
less per-render decompression. A single file larger than that target remains
intact. No result or initialized-engine cache is shared across requests. Raw SVG
worker output also removes JSON escaping/parsing and a duplicate UTF-8 encoding;
this is a reduction in copying, not a claimed end-to-end speedup.
