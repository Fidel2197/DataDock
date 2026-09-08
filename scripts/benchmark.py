"""Reproducible comparisons, not a claim about AWS or production traffic."""
import json
import platform
import statistics
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.analysis import normalized, parse_csv, sample_csv  # noqa: E402
from app.config import Settings  # noqa: E402

frame = pd.concat([parse_csv(sample_csv(), Settings())] * 41, ignore_index=True).head(10_000)


def baseline():
    missing, duplicate, trimmed = 0, 0, 0
    seen = set()
    for _, row in frame.iterrows():
        values = tuple(str(v).strip() for v in row)
        missing += sum(v == "" for v in values)
        trimmed += sum(str(raw) != value for raw, value in zip(row, values))
        duplicate += values in seen
        seen.add(values)
    return missing, duplicate, trimmed


def vectorized():
    clean = normalized(frame)
    return int(clean.eq("").to_numpy().sum()), int(clean.duplicated().sum()), int(frame.ne(clean).to_numpy().sum())


def measure(function):
    values = []
    for _ in range(5):
        start = time.perf_counter()
        result = function()
        values.append((time.perf_counter() - start) * 1000)
    return result, round(statistics.median(values), 2)


old, before = measure(baseline)
new, after = measure(vectorized)
assert old == new
records = frame.to_dict(orient="records")
full_bytes = len(json.dumps(records).encode())
page_bytes = len(json.dumps(records[:25]).encode())
print(json.dumps({"environment": {"platform": platform.platform(), "python": platform.python_version(), "pandas": pd.__version__}, "dataset": {"rows": len(frame), "columns": len(frame.columns), "source": "deterministic synthetic sample repeated to 10000 records"}, "checks": ["blank cells", "duplicate rows after trimming", "whitespace changes"], "repetitions": 5, "median_loop_ms": before, "median_vectorized_ms": after, "speedup": round(before / after, 2), "results_match": True, "all_rows_json_bytes": full_bytes, "25_rows_json_bytes": page_bytes, "scope": "Local microbenchmark of three equivalent checks and plain row serialization. Excludes upload, network, database writes, additional profiling, API wrappers, and concurrent users."}, indent=2))
