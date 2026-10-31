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

## Basic format, co-read groups and deferred transfers (0.2.3)

[CI run 41172441092](https://github.com/lofcz/tikz/actions/runs/41172441092)
compares this implementation with published 0.2.2. Node 22/24 passed 24 tests,
including basic/full/unprepared format equivalence, UTF-8 with bundled fonts,
extra libraries, generated font maps, embedded images, deferred input mutation
isolation, and package relocation.

Node 24 medians, three fresh processes each:

| Fixture | 0.2.2 → candidate time | Inflated bytes, 0.2.2 → candidate |
| --- | ---: | ---: |
| Line and math | 322.48 → 267.59 ms | 11,394,598 → 3,416,732 |
| pgfplots | 508.83 → 488.13 ms | 11,897,960 → 6,114,514 |
| LuaTeX graph | 681.67 → 664.05 ms | 18,925,080 → 8,923,593 |
| 756-node drawing | 3,206.13 → 3,164.75 ms | 11,892,765 → 3,454,559 |

`benchmarks/browser.mjs BASELINE CANDIDATE` uses a fresh browser context for every
render, with HTTP caching disabled. CI adds 20 ms latency per asset response;
responses are uncompressed and bandwidth is not throttled. Medians of two cold
renders per fixture and version:

| Fixture | 0.2.2 → candidate time | Asset requests | Response-body bytes |
| --- | ---: | ---: | ---: |
| Line and math | 2,546.35 → 868.35 ms | 125 → 54 | 8,271,195 → 7,863,765 |
| pgfplots | 3,817.05 → 1,135.20 ms | 168 → 56 | 10,399,905 → 10,561,547 |

All benchmark SVG hashes match. These measurements describe the stated test
conditions, not all networks. Package size rises from 32.8 to 35.8 MiB; the basic
format is 3,158,691 bytes versus 5,819,794 for the full one. Build it from the
pinned latex.fmt with the pinned WASM; no system TeX or runtime cache is needed.

`node scripts/profile-bundle-usage.mjs` records a bitmask of which fixture reads
each file; the build groups matching masks, with a fresh chunk at each boundary.
All other files remain in cold groups. The fixture corpus also includes circuits,
decorations and commutative diagrams; UTF-8 and generated-file tests are separate.
DVI handoff borrows only completed non-WASM-heap buffers. Auxiliary inputs are
copied when first opened and remain isolated from caller-owned bytes.
