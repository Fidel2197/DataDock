# Performance evidence

Recorded locally using Python 3.12.14 and pandas 2.3.3 on Windows 11. The deterministic synthetic sample is repeated to 10,000 rows / 8 columns. Five repetitions; values below are medians.

| Equivalent computation | Median |
|---|---:|
| `iterrows` baseline: missing cells, trimmed cells, duplicates | 284.11 ms |
| Vectorized pandas checks | 25.20 ms |
| Observed ratio | 11.27× |

The script asserts identical results for the baseline and vectorized checks. This is a **microbenchmark of three checks**, not an 11× claim for the entire API. It excludes upload, network, database writes, other profiling, and concurrent traffic. Reruns and other hardware will differ.

Plain JSON serialization of all 10,000 rows measured 1,936,833 bytes; 25 rows measured 4,841 bytes. The live row endpoint also includes issue flags and metadata, so these numbers demonstrate bounded row transfer rather than exact endpoint payloads.

The production build separates the dashboard and chart dependencies into dynamic chunks. Charts are loaded on the dashboard route; the upload/review screens do not need that code. At the initial build, the chart dependency chunk was about 111 KB gzip, separate from the main bundle. Exact assets and sizes change after source updates.

Other concrete choices: 25-row pagination, composite database indexes, 250 ms debounced search, 30-second query staleness, reusable row/stat components, gzip, and immutable caching for hashed assets. There is no unmeasured Lighthouse score or AWS load-test claim.

Reproduce from the project root after dependency installation:

```bash
python scripts/benchmark.py
```

Machine-readable results: [benchmark-results.json](benchmark-results.json).
