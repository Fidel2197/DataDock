import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  Download,
  ChartNoAxesCombined,
  Columns3,
  CheckCircle2,
  Rows3,
  LoaderCircle,
} from "lucide-react";
import { api, downloadReport } from "./api";
import { label, number } from "./utils";
import { Stat } from "./Review";
import type { Report } from "./types";
const colors = [
  "#168b78",
  "#3d73b9",
  "#73aebb",
  "#a5c2d0",
  "#697faf",
  "#b4d2c3",
  "#98a9b1",
  "#365b76",
  "#599d8c",
  "#8ab6bd",
  "#5872ad",
  "#abc9da",
];
export default function Dashboard({
  report,
  onReview,
  notify,
}: {
  report: Report;
  onReview: () => void;
  notify: (s: string) => void;
}) {
  const p = report.profile;
  const numeric = p.columns.filter((c) => c.kind === "number");
  const [category, setCategory] = useState(
    p.columns.find((c) => c.kind === "text" && c.unique < 30)?.name ||
      p.columns[0].name,
  );
  const [metric, setMetric] = useState(numeric[0]?.name || "");
  const [aggregation, setAggregation] = useState(
    numeric.length ? "sum" : "count",
  );
  const [distribution, setDistribution] = useState(
    numeric[0]?.name || p.columns[0].name,
  );
  const [downloading, setDownloading] = useState(false);
  const chart = useQuery({
    queryKey: ["chart", report.id, category, metric, aggregation],
    queryFn: () =>
      api<{
        data: { label: string; value: number }[];
        basis: string;
        categories: number;
        shown: number;
      }>(
        `/reports/${report.id}/chart?category=${encodeURIComponent(category)}&metric=${encodeURIComponent(metric)}&aggregation=${aggregation}`,
      ),
  });
  const column = p.columns.find((c) => c.name === distribution)!;
  async function download() {
    setDownloading(true);
    try {
      await downloadReport(report.id, "json");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }
  return (
    <>
      <div className="page-heading compact">
        <div>
          <div className="eyebrow">THE BIGGER PICTURE</div>
          <h1>Give the numbers some perspective.</h1>
          <p>Explore your original dataset. Follow the patterns that matter.</p>
        </div>
        <button
          className="button secondary"
          disabled={downloading}
          onClick={() => void download()}
        >
          <Download size={17} />
          {downloading ? "Downloading…" : "Export report"}
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          icon={<Rows3 size={19} />}
          title="Records analyzed"
          value={number(p.row_count)}
          detail="Based on the original upload"
        />
        <Stat
          icon={<CheckCircle2 size={19} />}
          title="Data completeness"
          value={`${p.completeness}%`}
          detail={`${number(p.missing_cells)} cells need a value`}
          tone="green"
        />
        <Stat
          icon={<Columns3 size={19} />}
          title="Available columns"
          value={number(p.column_count)}
          detail={`${numeric.length} numeric · ${p.column_count - numeric.length} text`}
          tone="blue"
        />
        <Stat
          icon={<ChartNoAxesCombined size={19} />}
          title="Rows to review"
          value={number(p.issue_rows)}
          detail="Includes all detected issue types"
          tone="amber"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel main-chart">
          <div className="panel-heading">
            <div>
              <h2>Compare across categories</h2>
              <p>Choose a grouping and a measure</p>
            </div>
            <span className="badge">Original data</span>
          </div>
          <div className="chart-controls">
            <label>
              Group by
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {p.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {label(c.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Measure
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                disabled={aggregation === "count"}
              >
                {numeric.length ? (
                  numeric.map((c) => (
                    <option key={c.name} value={c.name}>
                      {label(c.name)}
                    </option>
                  ))
                ) : (
                  <option>No numeric columns</option>
                )}
              </select>
            </label>
            <label>
              Calculate
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
              >
                {numeric.length > 0 && (
                  <>
                    <option value="sum">Total</option>
                    <option value="mean">Average</option>
                  </>
                )}
                <option value="count">Row count</option>
              </select>
            </label>
          </div>
          <div
            className="chart-container"
            role="img"
            aria-label={`${aggregation} ${metric} by ${category}. Exact values are available below.`}
          >
            {chart.isPending ? (
              <div className="loading-state">
                <LoaderCircle className="spin" />
              </div>
            ) : chart.isError ? (
              <div className="table-message inline-error" role="alert">
                {chart.error.message}
                <button
                  className="text-button"
                  onClick={() => void chart.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart.data?.data}
                  margin={{ top: 15, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke="#e7edef"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#70838d" }}
                    tickFormatter={(v) =>
                      String(v).length > 13
                        ? String(v).slice(0, 12) + "…"
                        : String(v)
                    }
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#70838d" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      Math.abs(v) >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : number(v)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f6f7" }}
                    formatter={(v) => number(Number(v))}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #dce7eb",
                      fontSize: 14,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name={aggregation === "count" ? "Records" : label(metric)}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={55}
                  >
                    {chart.data?.data.map((entry, i) => (
                      <Cell
                        key={entry.label}
                        fill={colors[i % colors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <details className="chart-values">
            <summary>
              View chart values{" "}
              {chart.data &&
                `(${chart.data.shown} of ${chart.data.categories} categories)`}
            </summary>
            <table>
              <thead>
                <tr>
                  <th>{label(category)}</th>
                  <th>{aggregation === "count" ? "Rows" : label(metric)}</th>
                </tr>
              </thead>
              <tbody>
                {chart.data?.data.map((d) => (
                  <tr key={d.label}>
                    <td>{d.label}</td>
                    <td>{number(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="chart-footnote">
            {chart.data?.basis ||
              "Numeric totals and averages ignore empty and invalid values."}
          </p>
        </section>
        <section className="panel quality-panel">
          <div className="panel-heading">
            <div>
              <h2>Quality at a glance</h2>
              <p>Understand what needs attention</p>
            </div>
          </div>
          <div
            className="quality-ring"
            style={{
              background: `conic-gradient(#168b78 ${p.quality_score}%, #e4eeed 0)`,
            }}
          >
            <div>
              <strong>
                {p.quality_score}
                <span>%</span>
              </strong>
              <small>rows without issues</small>
            </div>
          </div>
          <div className="quality-legend">
            <span>
              <i className="green-dot" />
              {number(p.clean_rows)} clear
            </span>
            <span>
              <i />
              {number(p.issue_rows)} to review
            </span>
          </div>
          <div className="issue-count-list">
            {Object.entries(p.issue_counts).map(([kind, count]) => (
              <div key={kind}>
                <span>
                  {
                    (
                      {
                        missing: "Missing cells",
                        duplicate: "Duplicate rows",
                        invalid: "Invalid numeric cells",
                        outlier: "Outlier suggestions",
                        whitespace: "Cells with extra spaces",
                      } as Record<string, string>
                    )[kind]
                  }
                </span>
                <strong>{number(count)}</strong>
              </div>
            ))}
          </div>
          <button className="text-button" onClick={onReview}>
            Review flagged records <ArrowLeft size={15} />
          </button>
        </section>
        <section className="panel chart-panel distribution-panel">
          <div className="panel-heading">
            <div>
              <h2>A closer look at one column</h2>
              <p>
                {column.kind === "number"
                  ? "Frequency across numeric ranges"
                  : "Most frequent values, excluding empty cells"}
              </p>
            </div>
            <label className="sr-only" htmlFor="distribution">
              Distribution column
            </label>
            <select
              id="distribution"
              value={distribution}
              onChange={(e) => setDistribution(e.target.value)}
            >
              {p.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {label(c.name)}
                </option>
              ))}
            </select>
          </div>
          <div
            className="chart-container short"
            role="img"
            aria-label={`Distribution of ${label(distribution)}. Exact counts follow.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={column.distribution}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#e7edef"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "#70838d" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => String(v).slice(0, 15)}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#70838d" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #dce7eb",
                    fontSize: 14,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Records"
                  fill="#638cb9"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-values">
            <summary>View distribution counts</summary>
            <table>
              <thead>
                <tr>
                  <th>Range or value</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {column.distribution.map((d, i) => (
                  <tr key={i}>
                    <td>{d.label}</td>
                    <td>{number(d.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {column.kind === "number" && (
            <div className="numeric-summary">
              {[
                ["Minimum", column.min],
                ["Median", column.median],
                ["Average", column.mean],
                ["Maximum", column.max],
              ].map(([title, value]) => (
                <div key={title}>
                  <small>{title}</small>
                  <strong>{number(Number(value))}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel columns-panel">
          <div className="panel-heading">
            <div>
              <h2>Column completeness</h2>
              <p>Filled cells in each column</p>
            </div>
          </div>
          <div className="completeness-list">
            {p.columns.map((c) => (
              <div key={c.name}>
                <div>
                  <span>{label(c.name)}</span>
                  <strong>{c.completeness}%</strong>
                </div>
                <progress
                  value={c.completeness}
                  max={100}
                  aria-label={`${label(c.name)} completeness`}
                />
                <small>
                  {c.unique} unique values · {c.kind}
                </small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
