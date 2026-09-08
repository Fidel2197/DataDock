import { useMemo, useState } from "react";
import {
  ArrowRight,
  FileSpreadsheet,
  Plus,
  Search,
  History,
  CheckCircle2,
} from "lucide-react";
import { bytes, date, number } from "./utils";
import type { ReportSummary, User } from "./types";
export default function ReportHistory({
  reports,
  loading,
  error,
  retry,
  onOpen,
  onUpload,
  user,
}: {
  reports: ReportSummary[];
  loading: boolean;
  error?: string;
  retry: () => void;
  onOpen: (id: string) => void;
  onUpload: () => void;
  user: User | null;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const filtered = useMemo(
    () =>
      reports
        .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "rows"
              ? b.row_count - a.row_count
              : new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
        ),
    [reports, search, sort],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div>
          <h1>Every dataset has a paper trail.</h1>
          <p>Your saved reports and cleaning settings, ready when you are.</p>
        </div>
        <button className="button primary" onClick={onUpload}>
          <Plus size={17} />
          New upload
        </button>
      </div>
      <div className="history-summary">
        <div>
          <History size={20} />
          <span>
            <strong>{reports.length}</strong> saved reports
          </span>
        </div>
        <div>
          <CheckCircle2 size={20} />
          <span>
            <strong>{reports.filter((r) => r.clean_summary).length}</strong>{" "}
            prepared for export
          </span>
        </div>
        <div>
          <FileSpreadsheet size={20} />
          <span>
            <strong>
              {number(reports.reduce((sum, r) => sum + r.row_count, 0))}
            </strong>{" "}
            records analyzed
          </span>
        </div>
      </div>
      <section className="panel history-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search saved reports"
              placeholder="Find a dataset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="sort-control">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Most recent</option>
              <option value="name">File name</option>
              <option value="rows">Most records</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="table-message" role="status">
            Loading reports...
          </div>
        ) : error ? (
          <div className="table-message inline-error" role="alert">
            {error}
            <button className="text-button" onClick={retry}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state small">
            <History size={35} />
            <h2>{search ? "No matching reports" : "A fresh workspace"}</h2>
            <p>
              {search
                ? "Try a different file name."
                : "Your first report will appear here after an upload."}
            </p>
            {!search && (
              <button className="button secondary" onClick={onUpload}>
                Upload a dataset <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Records</th>
                  <th>Quality</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="history-name">
                        <span className="file-icon">
                          <FileSpreadsheet size={21} />
                        </span>
                        <div>
                          <button
                            className="filename-button"
                            onClick={() => onOpen(r.id)}
                          >
                            {r.name}
                          </button>
                          <small>
                            {bytes(r.byte_size)} · {r.column_count} columns
                            {r.sample ? " · Example dataset" : ""}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{number(r.row_count)}</td>
                    <td>
                      <div className="quality-mini">
                        <span>{r.quality_score}%</span>
                        <progress
                          value={r.quality_score}
                          max={100}
                          aria-label={`${r.name} quality`}
                        />
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          "badge " + (r.clean_summary ? "green" : "blue")
                        }
                      >
                        {r.clean_summary ? "Export ready" : "Analyzed"}
                      </span>
                    </td>
                    <td className="date-cell">{date(r.created_at)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${r.name}`}
                        onClick={() => onOpen(r.id)}
                      >
                        <ArrowRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="history-note">
        <CheckCircle2 size={17} />
        <p>
          {user ? (
            "Your reports are saved to your account. Sign in on any device to pick up where you left off."
          ) : (
            <>
              Guest reports stay in this browser’s workspace.{" "}
              <a href="#account">Create an account</a> to keep them across
              devices.
            </>
          )}
        </p>
      </div>
    </>
  );
}
