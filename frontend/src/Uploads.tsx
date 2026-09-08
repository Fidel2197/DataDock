import { useRef, useState } from "react";
import {
  Upload,
  ArrowUpRight,
  FileSpreadsheet,
  ArrowRight,
  LoaderCircle,
  Download,
  CheckCircle2,
} from "lucide-react";
import { api, uploadFile } from "./api";
import { bytes, date, number } from "./utils";
import type { Report, ReportSummary } from "./types";
export default function Uploads({
  onOpen,
  onHistory,
  reports,
  notify,
}: {
  onOpen: (r: Report) => void;
  onHistory: () => void;
  reports: ReportSummary[];
  notify: (s: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file. Excel workbooks can be saved as CSV first.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("This file is too large. Choose a CSV under 10 MB.");
      return;
    }
    setBusy(true);
    setFilename(file.name);
    setProgress(0);
    try {
      onOpen(await uploadFile(file, setProgress));
      notify("Dataset analyzed. Your report is ready.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function sample() {
    setBusy(true);
    setFilename("research_programs_2026.csv");
    setProgress(100);
    setError("");
    try {
      onOpen(await api<Report>("/sample", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEARER START</div>
          <h1>Your next insight starts here.</h1>
          <p>Bring your CSV. We’ll help you make sense of it.</p>
        </div>
        <span className="step-indicator">
          01 <span>/ 04</span>
        </span>
      </div>
      <section
        aria-label="Upload dataset"
        className={`upload-card ${drag ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length > 1) {
            setError("Upload one dataset at a time.");
            return;
          }
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <div className="upload-icon">
          {busy ? (
            <LoaderCircle className="spin" size={28} />
          ) : (
            <Upload size={28} />
          )}
        </div>
        <h2>
          {busy
            ? progress === 100
              ? "Finding the story in your data…"
              : "Bringing your dataset aboard…"
            : "Drop a dataset into your workspace"}
        </h2>
        <p>
          {busy
            ? filename
            : "Upload a CSV to check its quality and explore the details."}
        </p>
        <input
          className="sr-only"
          type="file"
          id="csv-file"
          accept=".csv,text/csv"
          ref={input}
          onChange={(e) => void upload(e.target.files?.[0])}
          disabled={busy}
        />
        <button
          className="button primary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          {busy ? "Analyzing dataset" : "Choose CSV file"}{" "}
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ArrowUpRight size={17} />
          )}
        </button>
        {busy ? (
          <div className="upload-progress" role="status">
            <progress max={100} value={progress} aria-label="Upload progress" />
            <small>
              {progress < 100
                ? `${progress}% uploaded`
                : "Upload complete · Checking columns and saving your report"}
            </small>
          </div>
        ) : (
          <small>UTF-8 CSV · Up to 10 MB · 100,000 rows · 64 columns</small>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="sample-card">
        <div className="sample-art">
          <FileSpreadsheet size={34} />
        </div>
        <div>
          <div className="eyebrow">TAKE IT FOR A SPIN</div>
          <h2>A little messy. A lot to discover.</h2>
          <p>
            Explore research program spending, complete with missing values,
            duplicate records, and a few unusual numbers.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void sample()}
        >
          Explore sample <ArrowRight size={17} />
        </button>
      </section>
      {reports.length > 0 && (
        <section className="recent-block">
          <div className="section-heading">
            <h2>Recently docked</h2>
            <button className="text-button" onClick={onHistory}>
              All reports <ArrowRight size={15} />
            </button>
          </div>
          {reports.slice(0, 3).map((r) => (
            <a className="recent-row" href={`#review/${r.id}`} key={r.id}>
              <span className="file-icon">
                <FileSpreadsheet size={21} />
              </span>
              <div>
                <strong>{r.name}</strong>
                <small>
                  {number(r.row_count)} rows · {bytes(r.byte_size)} ·{" "}
                  {date(r.created_at)}
                </small>
              </div>
              <span className="badge">
                {r.clean_summary ? (
                  <>
                    <CheckCircle2 size={13} />
                    Cleaned
                  </>
                ) : (
                  "Analyzed"
                )}
              </span>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </section>
      )}
      <div className="section-heading">
        <h2>A simple path to reliable data</h2>
        <span>Four steps. One workspace.</span>
      </div>
      <div className="flow-grid">
        {[
          [
            "01",
            "Bring your data",
            "Start with a CSV upload or the sample dataset.",
          ],
          [
            "02",
            "Find the friction",
            "Spot missing values, duplicates, and unusual numbers.",
          ],
          [
            "03",
            "See the story",
            "Explore distributions and compare categories.",
          ],
          [
            "04",
            "Take it with you",
            "Export a cleaned file and keep the report.",
          ],
        ].map(([n, t, d]) => (
          <div className="flow-step" key={n}>
            <span>{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <a className="sample-download" href="/api/sample.csv" download>
        <Download size={14} />
        Download the sample CSV
      </a>
    </>
  );
}
