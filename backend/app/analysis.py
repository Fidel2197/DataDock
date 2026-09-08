import csv
import io
import math
import re
import time

import numpy as np
import pandas as pd

from .config import Settings


class DatasetError(ValueError):
    pass


def parse_csv(content: bytes, settings: Settings) -> pd.DataFrame:
    if len(content) > settings.max_upload_bytes:
        raise DatasetError(f"This file exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DatasetError("Save your file as a UTF-8 CSV and try again.") from exc
    if "\x00" in text:
        raise DatasetError("This file contains binary data. Upload a plain-text CSV.")
    try:
        reader = csv.reader(io.StringIO(text), strict=True)
        header = next(reader, None)
        if not header or not any(h.strip() for h in header):
            raise DatasetError("Add a header row with a name for each column.")
        header = [h.strip() for h in header]
        if len(header) > settings.max_columns:
            raise DatasetError("Use a dataset with 64 columns or fewer.")
        if any(not h or len(h) > 100 for h in header) or len(set(header)) != len(header):
            raise DatasetError("Column names must be unique, nonempty, and at most 100 characters.")
        records = []
        for line, row in enumerate(reader, start=2):
            if not row:
                continue
            if len(row) != len(header):
                raise DatasetError(
                    f"Record {line} has {len(row)} fields; expected {len(header)}. Check delimiters and quotes."
                )
            records.append(row)
            if len(records) * len(header) > settings.max_cells:
                raise DatasetError(
                    "Use a dataset with one million cells or fewer. Split wide datasets into smaller files."
                )
            if len(records) > settings.max_rows:
                raise DatasetError("Use a dataset with 100,000 rows or fewer.")
        if not records:
            raise DatasetError("This file has column names but no data rows.")
        return pd.DataFrame(records, columns=header, dtype=str)
    except (csv.Error, OverflowError) as exc:
        raise DatasetError("The CSV could not be read. Check its quoting and delimiter format.") from exc


def normalized(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.apply(lambda column: column.str.strip())


def numeric_values(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series.mask(series.eq("")), errors="coerce")
    return values.where(values.abs() <= 1e100)


def profile_dataset(frame: pd.DataFrame) -> tuple[dict, list[list[dict]]]:
    started = time.perf_counter()
    clean = normalized(frame)
    missing = clean.eq("")
    duplicates = clean.duplicated(keep="first")
    issues: list[list[dict]] = [[] for _ in range(len(frame))]
    columns = []
    issue_counts = {
        "missing": int(missing.to_numpy().sum()),
        "duplicate": int(duplicates.sum()),
        "invalid": 0,
        "outlier": 0,
        "whitespace": 0,
    }

    def mark(mask: pd.Series, kind: str, column: str, message: str):
        for index in np.flatnonzero(mask.to_numpy()):
            issues[int(index)].append({"kind": kind, "column": column, "message": message})

    mark(duplicates, "duplicate", "", "Matches an earlier record after trimming spaces.")
    for name in clean.columns:
        series = clean[name]
        present = series.ne("")
        count = int(present.sum())
        whitespace = frame[name].ne(series)
        issue_counts["whitespace"] += int(whitespace.sum())
        mark(missing[name], "missing", name, "This value is empty.")
        mark(whitespace, "whitespace", name, "Leading or trailing spaces can be trimmed.")
        num = numeric_values(series)
        is_identifier = bool(re.search(r"(^id$|_id$|code|zip|postal|phone)", name, re.I))
        is_number = count > 0 and num.notna().sum() / count >= 0.8 and not is_identifier
        info = {
            "name": name,
            "kind": "number" if is_number else "text",
            "missing": int(missing[name].sum()),
            "unique": int(series[present].nunique()),
            "completeness": round(count / len(frame) * 100, 1),
        }
        if is_number:
            invalid = present & num.isna()
            issue_counts["invalid"] += int(invalid.sum())
            mark(
                invalid,
                "invalid",
                name,
                "Most values in this column are numbers; this value is not a finite number.",
            )
            valid = num.dropna()
            q1, q3 = valid.quantile([0.25, 0.75])
            iqr = q3 - q1
            outliers = (
                ((num < q1 - 1.5 * iqr) | (num > q3 + 1.5 * iqr))
                if iqr > 0 and len(valid) >= 8
                else pd.Series(False, index=series.index)
            )
            issue_counts["outlier"] += int(outliers.sum())
            mark(outliers, "outlier", name, "Outside the 1.5× interquartile range. Review before changing.")
            info.update(
                {
                    "min": float(valid.min()),
                    "max": float(valid.max()),
                    "mean": round(float(valid.mean()), 2),
                    "median": round(float(valid.median()), 2),
                    "sum": round(float(valid.sum()), 2),
                }
            )
            bins = min(10, max(1, int(valid.nunique())))
            heights, edges = np.histogram(valid.to_numpy(dtype=float), bins=bins)
            info["distribution"] = [
                {
                    "label": f"{edges[i]:,.0f}–{edges[i + 1]:,.0f}"
                    if edges[-1] - edges[0] > 20
                    else f"{edges[i]:.2g}–{edges[i + 1]:.2g}",
                    "count": int(n),
                }
                for i, n in enumerate(heights)
            ]
        else:
            counts = series[present].value_counts().head(10)
            info["distribution"] = [{"label": str(label), "count": int(n)} for label, n in counts.items()]
        columns.append(info)
    affected = sum(bool(row) for row in issues)
    return {
        "row_count": len(frame),
        "column_count": len(frame.columns),
        "missing_cells": issue_counts["missing"],
        "duplicate_rows": issue_counts["duplicate"],
        "issue_rows": affected,
        "clean_rows": len(frame) - affected,
        "quality_score": round((len(frame) - affected) / len(frame) * 100, 1),
        "completeness": round((1 - missing.to_numpy().sum() / frame.size) * 100, 1),
        "issue_counts": issue_counts,
        "columns": columns,
        "analysis_ms": round((time.perf_counter() - started) * 1000, 2),
        "method": "Missing means blank or whitespace-only. Duplicates compare all trimmed fields. Numeric inference requires 80% numeric values, excluding identifier columns. Outliers use 1.5× IQR and are review suggestions, not confirmed errors.",
    }, issues


def clean_dataset(frame: pd.DataFrame, options: dict) -> tuple[pd.DataFrame, dict]:
    result = normalized(frame) if options.get("trim_whitespace") else frame.copy()
    trimmed = int(frame.ne(result).to_numpy().sum())
    empty = 0
    if options.get("drop_empty_rows"):
        mask = normalized(result).eq("").all(axis=1)
        empty = int(mask.sum())
        result = result.loc[~mask]
    duplicate = 0
    if options.get("drop_duplicates"):
        mask = result.duplicated(keep="first")
        duplicate = int(mask.sum())
        result = result.loc[~mask]
    return result.reset_index(drop=True), {
        "original_rows": len(frame),
        "cleaned_rows": len(result),
        "duplicates_removed": duplicate,
        "empty_rows_removed": empty,
        "cells_trimmed": trimmed,
        "removed_rows": len(frame) - len(result),
    }


def spreadsheet_safe_csv(frame: pd.DataFrame) -> bytes:
    # Quote formula-like strings, including headers, when opening in spreadsheet software.
    # Ordinary finite negative numbers remain numeric.
    def protect(value: str) -> str:
        stripped = value.lstrip()
        if stripped.startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")):
            try:
                if math.isfinite(float(stripped)):
                    return value
            except ValueError:
                pass
            return "'" + value
        return value

    safe = frame.map(protect)
    safe.columns = [protect(str(name)) for name in safe.columns]
    return safe.to_csv(index=False, lineterminator="\n").encode("utf-8-sig")


def sample_csv() -> bytes:
    rng = np.random.default_rng(2197)
    records = []
    departments = ["Biology", "Engineering", "Computer Science", "Environmental Science", "Chemistry"]
    for i in range(240):
        department = departments[i % len(departments)]
        records.append(
            {
                "record_id": f"RS-{i + 1:04d}",
                "department": department,
                "program": ["Field research", "Lab equipment", "Student support"][i % 3],
                "month": f"2026-{(i % 6) + 1:02d}",
                "budget_usd": str(int(rng.integers(1500, 14000))),
                "actual_usd": str(int(rng.integers(1000, 12500))),
                "participants": str(int(rng.integers(5, 90))),
                "status": ["Complete", "Active", "Complete", "In review"][i % 4],
            }
        )
    for i in [7, 18, 29, 48, 83, 122, 167, 201]:
        records[i]["actual_usd"] = ""
    for i in [11, 37, 91, 150]:
        records[i]["department"] = ""
    for i in [3, 15, 88, 134, 177, 220]:
        records[i]["program"] = "  " + records[i]["program"] + " "
    for i in [31, 74, 163]:
        records[i]["participants"] = "pending"
    records[55]["actual_usd"] = "98500"
    records[192]["actual_usd"] = "120000"
    records.extend([dict(records[i]) for i in [5, 25, 65, 105, 145, 185]])
    return pd.DataFrame(records).to_csv(index=False).encode()
