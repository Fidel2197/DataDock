import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Upload,
  Table2,
  ChartNoAxesCombined,
  History,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  X,
  LoaderCircle,
  FileSpreadsheet,
  BookOpen,
  UserRound,
} from "lucide-react";
import { api, startSession } from "./api";
import { readRoute } from "./utils";
import type { Report, ReportSummary, View, SessionInfo } from "./types";
import Uploads from "./Uploads";
import Review from "./Review";
import ReportHistory from "./ReportHistory";
import Guide from "./Guide";
import Account from "./Account";
const Dashboard = lazy(() => import("./Dashboard"));
const labels: Record<View, string> = {
  uploads: "Uploads",
  review: "Data review",
  dashboard: "Dashboard",
  history: "Report history",
  guide: "Quick guide",
  account: "Your account",
};
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: startSession,
    staleTime: Infinity,
    retry: 1,
  });
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<ReportSummary[]>("/reports"),
    enabled: session.isSuccess,
  });
  const selectedId = route.id || reports.data?.[0]?.id || "";
  const report = useQuery({
    queryKey: ["report", selectedId],
    queryFn: () => api<Report>(`/reports/${selectedId}`),
    enabled:
      session.isSuccess &&
      !!selectedId &&
      (route.view === "review" || route.view === "dashboard"),
  });
  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${labels[route.view]} · DataDock`;
  }, [route.view]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function go(view: View, id = selectedId) {
    window.location.hash =
      view +
      (id && (view === "review" || view === "dashboard") ? "/" + id : "");
  }
  function opened(data: Report) {
    client.setQueryData(["report", data.id], data);
    void client.invalidateQueries({ queryKey: ["reports"] });
    go("review", data.id);
  }
  function accountChanged(data: SessionInfo) {
    void client.cancelQueries();
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
    const { recovery_code: _recovery, ...current } = data;
    client.setQueryData(["session"], current);
  }
  const ready = session.isSuccess;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#uploads" aria-label="DataDock home">
          <span className="brand-mark">
            <Database size={23} />
          </span>
          DataDock<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ANALYST WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              [Upload, "uploads"],
              [Table2, "review"],
              [ChartNoAxesCombined, "dashboard"],
              [History, "history"],
              [BookOpen, "guide"],
            ] as const
          ).map(([Icon, key]) => (
            <a
              href={`#${key}${selectedId && (key === "review" || key === "dashboard") ? "/" + selectedId : ""}`}
              key={key}
              aria-current={route.view === key ? "page" : undefined}
              className={"nav-item " + (route.view === key ? "active" : "")}
            >
              <Icon size={19} />
              {labels[key]}
              {key === "history" && !!reports.data?.length && (
                <span className="nav-count">{reports.data.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={21} />
          <strong>
            {session.data?.user
              ? "Your work stays with you."
              : "Start here. Keep it anywhere."}
          </strong>
          <p>
            {session.data?.user
              ? "Your reports are saved to your account and ready on your next device."
              : "Create an account to keep your reports across devices."}
          </p>
          <a href="#guide">
            A quick introduction <ArrowUpRight size={14} />
          </a>
        </div>
        <a href="#account" className="sidebar-footer account-footer">
          <span className="avatar">
            {session.data?.user?.name.slice(0, 2).toUpperCase() || (
              <UserRound size={18} />
            )}
          </span>
          <div>
            {session.data?.user?.name || "Your workspace"}
            <small>
              {session.data?.user
                ? "@" + session.data.user.username
                : "Sign in or create an account"}
            </small>
          </div>
          <ArrowUpRight size={16} />
        </a>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> {labels[route.view]}
          </span>
          <div className="topbar-actions">
            <a href="#guide" className="topbar-guide">
              <BookOpen size={16} />
              Quick guide
            </a>
            <a href="#account" className="account-button">
              <UserRound size={16} />
              {session.data?.user ? session.data.user.name : "Sign in"}
            </a>
          </div>
        </header>
        <div className="page">
          {session.isError ? (
            <ErrorPanel
              message="We couldn’t reach your workspace. Please try again in a moment."
              action={() => void session.refetch()}
              label="Reconnect"
            />
          ) : !ready ? (
            <Loading label="Opening your workspace…" />
          ) : (
            <>
              {route.view === "guide" && (
                <Guide
                  onUpload={() => go("uploads")}
                  onAccount={() => go("account")}
                />
              )}
              {route.view === "account" && (
                <Account
                  session={session.data!}
                  onChanged={accountChanged}
                  onContinue={() => go("uploads")}
                />
              )}
              {route.view === "uploads" && (
                <Uploads
                  onOpen={opened}
                  maxUploadMb={session.data?.max_upload_mb || 3}
                  onGuide={() => go("guide")}
                  onHistory={() => go("history")}
                  reports={reports.data || []}
                  notify={setNotice}
                />
              )}
              {route.view === "history" && (
                <ReportHistory
                  reports={reports.data || []}
                  loading={reports.isPending}
                  error={reports.error?.message}
                  retry={() => void reports.refetch()}
                  onOpen={(id) => go("review", id)}
                  onUpload={() => go("uploads")}
                  user={session.data?.user || null}
                />
              )}
              {(route.view === "review" || route.view === "dashboard") && (
                <>
                  {reports.isPending && !selectedId ? (
                    <Loading label="Finding your datasets…" />
                  ) : reports.isError && !selectedId ? (
                    <ErrorPanel
                      message={reports.error.message}
                      action={() => void reports.refetch()}
                    />
                  ) : !selectedId ? (
                    <EmptyDataset onUpload={() => go("uploads")} />
                  ) : report.isError ? (
                    <ErrorPanel
                      message={report.error.message}
                      action={() => void report.refetch()}
                    />
                  ) : !report.data ? (
                    <Loading label="Opening your report…" />
                  ) : (
                    <>
                      <div className="dataset-switcher">
                        <FileSpreadsheet size={17} />
                        <label className="sr-only" htmlFor="active-dataset">
                          Active dataset
                        </label>
                        <select
                          id="active-dataset"
                          value={selectedId}
                          onChange={(e) => go(route.view, e.target.value)}
                        >
                          {(reports.data || []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        {report.data.sample && (
                          <span className="badge blue">Example dataset</span>
                        )}
                      </div>
                      {route.view === "review" ? (
                        <Review
                          key={selectedId}
                          report={report.data}
                          onDashboard={() => go("dashboard")}
                          notify={setNotice}
                        />
                      ) : (
                        <Suspense
                          fallback={<Loading label="Loading your charts…" />}
                        >
                          <Dashboard
                            key={selectedId}
                            report={report.data}
                            onReview={() => go("review")}
                            notify={setNotice}
                          />
                        </Suspense>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
        <footer className="page-footer">
          <span>
            DataDock <span> / </span> From data to clarity
          </span>
          <a
            href="https://fidel-portfolio-eta.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            Built by Fidel Anyanwu <ArrowUpRight size={12} />
          </a>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={25} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorPanel({
  message,
  action,
  label = "Try again",
}: {
  message: string;
  action: () => void;
  label?: string;
}) {
  return (
    <div className="error-panel" role="alert">
      <AlertCircle size={24} />
      <h2>Something needs attention</h2>
      <p>{message}</p>
      <button className="button secondary" onClick={action}>
        {label}
      </button>
    </div>
  );
}
function EmptyDataset({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="empty-state">
      <FileSpreadsheet size={38} />
      <h1>First, bring a dataset.</h1>
      <p>Upload a CSV or explore the sample to start reviewing data.</p>
      <button className="button primary" onClick={onUpload}>
        Go to uploads <Upload size={17} />
      </button>
    </div>
  );
}
