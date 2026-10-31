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

## Clean CI comparison

[Node 24 CI run 41170467760](https://github.com/lofcz/tikz/actions/runs/41170467760)
passed all tests and output comparisons. Medians of three fresh processes:

| Fixture | 0.2.1 time → candidate | 0.2.1 peak RSS → candidate |
| --- | ---: | ---: |
| Line and math | 510.22 → 420.96 ms | 181.52 → 164.99 MiB |
| pgfplots | 769.68 → 694.70 ms | 187.60 → 155.03 MiB |
| LuaTeX graph | 1,070.61 → 934.51 ms | 230.38 → 202.02 MiB |
| 756-node drawing | 4,536.71 → 4,466.75 ms | 188.28 → 163.90 MiB |

These are runner measurements, not a Vercel latency guarantee.

## Native tuning

The source build now exposes `TEX_INITIAL_MEMORY`, `DVISVGM_INITIAL_MEMORY`,
`TEX_LTO`, and the existing `TEX_OPT`/`DVISVGM_OPT`. Defaults remain TeX 128 MiB,
dvisvgm 64 MiB, `-O2`/`-Oz`, and no LTO. Build flags invalidate compiled objects;
parallel compiler failures propagate instead of being hidden by a bare `wait`.

The C23 `-O3`/LTO/64 MiB TeX candidate passed the same four SVG comparisons but
increased tex.wasm from 1,130,229 to 1,278,876 bytes, with no consistent peak-RSS
reduction. Native timing samples were collected under shared-host load and do not
justify changing production defaults. The release retains pinned native binaries;
local native build outputs cannot silently replace them during package assembly.
Use the build controls for further controlled comparisons, not as runtime options.

A separate C23 `-O2` comparison reduced only TeX's initial memory, 128 → 64 MiB.
It preserved SVG hashes and reduced measured RSS in the local samples, but simple
and plot medians worsened (645 → 777 ms and 894 → 1,156 ms). The combined
`-O3`/LTO TeX 64 MiB + dvisvgm 32 MiB build also preserved all four fixtures,
but raised RSS by roughly 7–13 MiB in three fixtures. These shared-host results
support leaving the defaults unchanged, not a claim that smaller heaps can never
help. Both C23 candidates passed the MD5/regex/color-stack primitive checks.
