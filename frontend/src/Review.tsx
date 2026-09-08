import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
  Sparkles,
  Table2,
  Copy,
  FileWarning,
  LoaderCircle,
} from "lucide-react";
import { api, downloadReport } from "./api";
import { label, number } from "./utils";
import type {
  CleanOptions,
  CleanSummary,
  Report,
  RowsResponse,
  Row,
} from "./types";
export default function Review({
  report,
  onDashboard,
  notify,
}: {
  report: Report;
  onDashboard: () => void;
  notify: (s: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [options, setOptions] = useState<CleanOptions>(
    report.clean_options || {
      trim_whitespace: true,
      drop_duplicates: true,
      drop_empty_rows: true,
    },
  );
  const [cleaning, setCleaning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState(report.clean_summary);
  const [applied, setApplied] = useState(report.clean_options);
  const client = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const rows = useQuery({
    queryKey: ["rows", report.id, page, onlyIssues, debounced],
    queryFn: () =>
      api<RowsResponse>(
        `/reports/${report.id}/rows?page=${page}&page_size=25&issues_only=${onlyIssues}&search=${encodeURIComponent(debounced)}`,
      ),
    placeholderData: keepPreviousData,
  });
  const dirty = JSON.stringify(options) !== JSON.stringify(applied);
  async function clean() {
    setCleaning(true);
    try {
      const result = await api<{
        summary: CleanSummary;
        options: CleanOptions;
      }>(`/reports/${report.id}/clean`, {
        method: "POST",
        body: JSON.stringify(options),
      });
      setSummary(result.summary);
      setApplied(result.options);
      void client.invalidateQueries({ queryKey: ["reports"] });
      void client.invalidateQueries({ queryKey: ["report", report.id] });
      notify("Cleaning settings saved. Your original upload stays intact.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setCleaning(false);
    }
  }
  async function download() {
    setDownloading(true);
    try {
      await downloadReport(report.id, "csv");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }
  const p = report.profile;
  const pages = Math.max(1, Math.ceil((rows.data?.total || 0) / 25));
  return (
    <>
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">LOOK A LITTLE CLOSER</div>
          <h1>Good decisions start with good data.</h1>
          <p>Review what needs attention. Keep control of what changes.</p>
        </div>
        <button className="button secondary" onClick={onDashboard}>
          Explore dashboard <ArrowRight size={17} />
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          icon={<Table2 size={19} />}
          title="Total records"
          value={number(p.row_count)}
          detail={`${p.column_count} columns in this dataset`}
        />
        <Stat
          icon={<FileWarning size={19} />}
          title="Missing values"
          value={number(p.missing_cells)}
          detail={`${p.completeness}% of cells are filled`}
          tone="amber"
        />
        <Stat
          icon={<Copy size={19} />}
          title="Duplicate rows"
          value={number(p.duplicate_rows)}
          detail="Matching records after trimming"
          tone="blue"
        />
        <Stat
          icon={<CheckCircle2 size={19} />}
          title="Rows without issues"
          value={`${p.quality_score}%`}
          detail={`${number(p.clean_rows)} records pass all checks`}
          tone="green"
        />
      </div>
      <div className="review-layout">
        <section className="panel data-panel">
          <div className="panel-heading">
            <div>
              <h2>The details, row by row</h2>
              <p>Original values · Select a flagged row to see its issues</p>
            </div>
            <span className="badge amber">
              {number(p.issue_rows)} rows to review
            </span>
          </div>
          <div className="table-toolbar">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search dataset values"
                placeholder="Search any value…"
                maxLength={100}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className={"filter-button " + (onlyIssues ? "selected" : "")}
              aria-pressed={onlyIssues}
              onClick={() => {
                setOnlyIssues(!onlyIssues);
                setPage(1);
              }}
            >
              <Filter size={15} />
              Issues only
            </button>
          </div>
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Dataset table, scroll horizontally for more columns"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Check</th>
                  {p.columns.map((c) => (
                    <th key={c.name} scope="col">
                      <span className="column-type">
                        {c.kind === "number" ? "#" : "Aa"}
                      </span>
                      {label(c.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.data?.rows.map((row) => {
                  const open = expanded === row.row_number;
                  return (
                    <RowFragment
                      key={row.row_number}
                      row={row}
                      columns={p.columns.map((c) => c.name)}
                      open={open}
                      toggle={() => setExpanded(open ? null : row.row_number)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.isPending && (
            <div className="table-message" role="status">
              Loading rows…
            </div>
          )}
          {rows.isError && (
            <div className="table-message inline-error" role="alert">
              {rows.error.message}
              <button
                className="text-button"
                onClick={() => void rows.refetch()}
              >
                Try again
              </button>
            </div>
          )}
          {rows.data?.total === 0 && (
            <div className="table-message">
              No rows match these filters. Try a different search.
            </div>
          )}
          <div className="table-footer">
            <span>
              {rows.isFetching
                ? "Updating…"
                : `${number(rows.data?.total || 0)} matching records`}
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous page"
                onClick={() => {
                  setPage(page - 1);
                  setExpanded(null);
                }}
                disabled={page <= 1 || rows.isPlaceholderData}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                onClick={() => {
                  setPage(page + 1);
                  setExpanded(null);
                }}
                disabled={page >= pages || rows.isPlaceholderData}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>
        <aside className="panel clean-panel">
          <div className="clean-title">
            <span className="sparkle-icon">
              <Sparkles size={20} />
            </span>
            <div className="eyebrow">A FRESH COPY</div>
          </div>
          <h2>A little cleanup goes a long way.</h2>
          <p>
            Choose the changes for your export. Your original data is preserved.
          </p>
          <div className="clean-options">
            {(
              [
                [
                  "trim_whitespace",
                  "Trim extra spaces",
                  "Remove spaces at the start and end of values.",
                ],
                [
                  "drop_duplicates",
                  "Remove duplicate rows",
                  "Keep the first exact match after selected trimming.",
                ],
                [
                  "drop_empty_rows",
                  "Remove empty rows",
                  "Drop records with no filled cells.",
                ],
              ] as const
            ).map(([key, title, description]) => (
              <label key={key} className="check-option">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) =>
                    setOptions({ ...options, [key]: e.target.checked })
                  }
                />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="note-box">
            <AlertTriangle size={16} />
            <span>
              Missing values, unusual numbers, and invalid values stay for your
              review.
            </span>
          </div>
          <button
            className="button primary full"
            onClick={() => void clean()}
            disabled={cleaning}
          >
            {cleaning ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {cleaning ? "Preparing export…" : "Apply cleaning options"}
          </button>
          {summary && (
            <div className="clean-result" role="status">
              <strong>
                <CheckCircle2 size={16} />
                {dirty
                  ? "Previous export settings"
                  : "Your cleaned file is ready"}
              </strong>
              <dl>
                <div>
                  <dt>Records retained</dt>
                  <dd>{number(summary.cleaned_rows)}</dd>
                </div>
                <div>
                  <dt>Duplicates removed</dt>
                  <dd>{number(summary.duplicates_removed)}</dd>
                </div>
                <div>
                  <dt>Empty rows removed</dt>
                  <dd>{number(summary.empty_rows_removed)}</dd>
                </div>
                <div>
                  <dt>Values trimmed</dt>
                  <dd>{number(summary.cells_trimmed)}</dd>
                </div>
              </dl>
              {dirty && <p>Apply your new options before downloading.</p>}
              <button
                className="button secondary full"
                disabled={dirty || downloading}
                onClick={() => void download()}
              >
                <Download size={16} />
                {downloading ? "Downloading…" : "Download cleaned CSV"}
              </button>
            </div>
          )}
        </aside>
      </div>
      <details className="method-details">
        <summary>How DataDock checks your data</summary>
        <p>{p.method}</p>
        <p>
          Quality score = records with no flagged issues ÷ total records. Review
          suggestions affect this score, so it is not a certification of
          accuracy. Identifiers stay as text. Literal “NA” and “null” are
          preserved. CSV exports prefix formula-like text with an apostrophe for
          safer spreadsheet opening.
        </p>
      </details>
    </>
  );
}
function RowFragment({
  row,
  columns,
  open,
  toggle,
}: {
  row: Row;
  columns: string[];
  open: boolean;
  toggle: () => void;
}) {
  return (
    <Fragment>
      <tr className={row.issues.length ? "flagged-row" : ""}>
        <td className="row-number">{row.row_number}</td>
        <td>
          {row.issues.length ? (
            <button
              className="issue-button"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={`issues-${row.row_number}`}
              aria-label={`Review ${row.issues.length} issues in row ${row.row_number}`}
            >
              <AlertTriangle size={14} />
              {row.issues.length}
            </button>
          ) : (
            <CheckCircle2
              className="pass-icon"
              size={16}
              aria-label="No issues"
            />
          )}
        </td>
        {columns.map((c) => {
          const value = row.values[c];
          const problems = row.issues.filter((i) => i.column === c);
          return (
            <td
              key={c}
              className={problems.length ? "flagged-cell" : ""}
              title={
                problems.length
                  ? problems.map((i) => i.message).join(" ")
                  : value
              }
            >
              {value.trim() === "" ? (
                <span className="missing-value">Empty</span>
              ) : (
                value
              )}
            </td>
          );
        })}
      </tr>
      {open && (
        <tr id={`issues-${row.row_number}`} className="issue-detail">
          <td colSpan={columns.length + 2}>
            <ul>
              {row.issues.map((issue, i) => (
                <li key={i}>
                  <span className="badge amber">{label(issue.kind)}</span>
                  <strong>
                    {issue.column ? label(issue.column) : "Whole row"}
                  </strong>{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
export function Stat({
  icon,
  title,
  value,
  detail,
  tone = "",
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-label">
        {title}
        <span>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
