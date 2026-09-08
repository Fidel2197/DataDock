import io

import pandas as pd
import pytest

from app.analysis import (
    DatasetError,
    clean_dataset,
    parse_csv,
    profile_dataset,
    sample_csv,
    spreadsheet_safe_csv,
)
from app.config import Settings


def test_sample_expected_issues_and_reversible_cleaning():
    frame = parse_csv(sample_csv(), Settings())
    profile, issues = profile_dataset(frame)
    assert profile["row_count"] == 246
    assert profile["issue_counts"] == {
        "missing": 12,
        "duplicate": 6,
        "invalid": 3,
        "outlier": 2,
        "whitespace": 6,
    }
    assert profile["issue_rows"] == 29
    assert len(issues) == len(frame)
    cleaned, summary = clean_dataset(
        frame, {"trim_whitespace": True, "drop_duplicates": True, "drop_empty_rows": True}
    )
    assert len(cleaned) == 240
    assert summary["cells_trimmed"] == 6
    assert cleaned["participants"].eq("pending").sum() == 3
    assert cleaned["actual_usd"].eq("").sum() == 8
    assert cleaned["actual_usd"].eq("120000").sum() == 1
    assert len(frame) == 246  # Analysis and export never mutate the upload.


@pytest.mark.parametrize(
    "content", [b"", b"a,b\n", b"a,a\n1,2", b"a,\n1,2", b"a,b\n1,2,3", b"a,b\n\x00,2", b"a,b\n\xff,2"]
)
def test_invalid_csv_is_actionable(content):
    with pytest.raises(DatasetError):
        parse_csv(content, Settings())


def test_identifiers_na_and_multiline_fields_are_preserved():
    frame = parse_csv(
        b'id,amount,note\n001,2,"line one\nline two"\n002,3,NA\n003,4,null\n004,5,hello\n005,broken,world',
        Settings(),
    )
    profile, _ = profile_dataset(frame)
    assert profile["columns"][0]["kind"] == "text"
    assert profile["columns"][1]["kind"] == "number"
    assert frame.iloc[0]["id"] == "001"
    assert frame.iloc[1]["note"] == "NA"
    assert frame.iloc[0]["note"] == "line one\nline two"
    assert profile["missing_cells"] == 0
    assert profile["issue_counts"]["invalid"] == 1


def test_limits():
    with pytest.raises(DatasetError, match="million cells"):
        parse_csv(b"a,b\n1,2", Settings(max_cells=1))
    with pytest.raises(DatasetError, match="100,000"):
        parse_csv(b"a\n1\n2", Settings(max_rows=1))
    with pytest.raises(DatasetError, match="64"):
        parse_csv(b"a,b\n1,2", Settings(max_columns=1))
    with pytest.raises(DatasetError, match="exceeds"):
        parse_csv(b"a,b\n1,2", Settings(max_upload_bytes=1))


def test_export_formula_protection_including_headers():
    frame = pd.DataFrame({"=header": ["=SUM(A1:A2)", " +cmd", "@thing", "-12", "\tformula", "normal"]})
    exported = pd.read_csv(io.BytesIO(spreadsheet_safe_csv(frame)), dtype=str)
    assert exported.columns[0] == "'=header"
    assert exported.iloc[0, 0].startswith("'=")
    assert exported.iloc[1, 0].startswith("'")
    assert exported.iloc[2, 0].startswith("'@")
    assert exported.iloc[3, 0] == "-12"
    assert exported.iloc[4, 0].startswith("'")


def test_cleaning_choices_are_independent():
    frame = parse_csv(b"id,value\n1, a \n1,a\n,\n", Settings())
    untrimmed, _ = clean_dataset(frame, {"drop_duplicates": True})
    assert len(untrimmed) == 3
    trimmed, summary = clean_dataset(
        frame, {"trim_whitespace": True, "drop_duplicates": True, "drop_empty_rows": True}
    )
    assert len(trimmed) == 1
    assert summary["empty_rows_removed"] == 1
    assert summary["duplicates_removed"] == 1


def test_constant_and_all_empty_columns():
    frame = parse_csv(b"id,value,empty\na,5,\nb,5,\nc,5,", Settings())
    profile, _ = profile_dataset(frame)
    assert profile["columns"][1]["mean"] == 5
    assert sum(b["count"] for b in profile["columns"][1]["distribution"]) == 3
    assert profile["columns"][2]["distribution"] == []
