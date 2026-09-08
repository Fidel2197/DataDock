import {
  Database,
  Upload,
  Table2,
  ChartNoAxesCombined,
  History,
  BookOpen,
  UserRound,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { User, View } from "./types";

const links = [
  [Upload, "uploads", "Uploads"],
  [Table2, "review", "Data review"],
  [ChartNoAxesCombined, "dashboard", "Dashboard"],
  [History, "history", "Report history"],
  [BookOpen, "guide", "Quick guide"],
] as const;

export default function Sidebar({
  view,
  reportId,
  user,
  count,
  collapsed,
  onToggle,
}: {
  view: View;
  reportId: string;
  user: User | null;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <div className="sidebar-brand-row">
        <a
          className="brand"
          href="#uploads"
          aria-label="DataDock home"
          title="DataDock home"
        >
          <span className="brand-mark">
            <Database size={22} />
          </span>
          <span className="brand-name">
            DataDock<span className="brand-dot">.</span>
          </span>
        </a>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
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
      </div>
      <a
        href="#account"
        className="sidebar-account"
        aria-label={
          user ? `Your account, ${user.name}` : "Sign in or create an account"
        }
        title={
          user ? `Your account: ${user.name}` : "Sign in or create an account"
        }
        aria-current={view === "account" ? "page" : undefined}
      >
        <span className="avatar">
          {user ? user.name.slice(0, 2).toUpperCase() : <UserRound size={21} />}
        </span>
        <span className="sidebar-account-copy">
          <strong>{user?.name || "Your workspace"}</strong>
          <small>
            {user ? "@" + user.username : "Sign in / Create account"}
          </small>
        </span>
        <ArrowUpRight size={16} />
      </a>
      <div className="sidebar-navigation" id="sidebar-navigation">
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([Icon, key, label]) => (
            <a
              key={key}
              className={`nav-item ${view === key ? "active" : ""}`}
              href={`#${key}${reportId && (key === "review" || key === "dashboard") ? "/" + reportId : ""}`}
              aria-label={label}
              aria-current={view === key ? "page" : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon size={20} />
              <span className="nav-label">{label}</span>
              {key === "history" && count > 0 && (
                <span className="nav-count">{count}</span>
              )}
            </a>
          ))}
        </nav>
        <a className="sidebar-guide-card" href="#guide">
          <BookOpen size={20} />
          <strong>
            A little guidance.
            <br />A clearer next step.
          </strong>
          <span>
            Take the quick tour <ArrowUpRight size={14} />
          </span>
        </a>
      </div>
    </aside>
  );
}
