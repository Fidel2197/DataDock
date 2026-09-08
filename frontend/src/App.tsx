import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  ArrowUpRight,
  AlertCircle,
  X,
  LoaderCircle,
  FileSpreadsheet,
  BookOpen,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { api, startSession } from "./api";
import { readRoute } from "./utils";
import type { Report, ReportSummary, View, SessionInfo } from "./types";
import Uploads from "./Uploads";
import Review from "./Review";
import ReportHistory from "./ReportHistory";
import Guide from "./Guide";
import Account from "./Account";
import Sidebar from "./Sidebar";
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        localStorage.getItem("datadock.sidebar") === "collapsed" ||
        (localStorage.getItem("datadock.sidebar") === null &&
          window.matchMedia("(max-width: 760px)").matches)
      );
    } catch {
      return window.matchMedia("(max-width: 760px)").matches;
    }
  });
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("datadock.sidebar", next ? "collapsed" : "expanded");
    } catch {
      /* A layout preference remains usable without browser storage. */
    }
    if (window.matchMedia("(max-width: 760px)").matches) window.scrollTo(0, 0);
  }
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
    window.scrollTo(0, 0);
  }, [route.view, route.id]);
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
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== "session",
    });
    const { recovery_code: _recovery, ...current } = data;
    client.setQueryData(["session"], current);
  }
  const ready = session.isSuccess;
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a
        className="skip-link"
        href="#workspace"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workspace")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <Sidebar
        view={route.view}
        reportId={selectedId}
        user={session.data?.user || null}
        count={reports.data?.length || 0}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />
      <main id="workspace" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="layout-toggle"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
              aria-expanded={!collapsed}
              aria-controls="sidebar-navigation"
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
            <span className="breadcrumb">
              Workspace <span className="slash">/</span> {labels[route.view]}
            </span>
          </div>
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
              <Account
                session={session.data!}
                active={route.view === "account"}
                onChanged={accountChanged}
                onContinue={() => go("uploads")}
              />
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
