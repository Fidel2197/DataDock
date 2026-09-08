import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  UserRound,
  LockKeyhole,
  ShieldCheck,
  Download,
  Check,
  LogOut,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "./api";
import type { SessionInfo } from "./types";
export default function Account({
  session,
  onChanged,
  onContinue,
}: {
  session: SessionInfo;
  onChanged: (s: SessionInfo) => void;
  onContinue: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login" | "recover">(
    "register",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const body = {
      username: String(data.get("username")).trim(),
      name: String(data.get("name") || "").trim(),
      password: String(data.get("password")),
      recovery_code: String(data.get("recovery_code") || "").trim(),
      keep_reports: data.get("keep_reports") === "on",
    };
    try {
      const result = await api<SessionInfo>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onChanged(result);
      if (result.recovery_code) setRecovery(result.recovery_code);
      else onContinue();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      onChanged(await api<SessionInfo>("/auth/logout", { method: "POST" }));
      onContinue();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const blob = new Blob(
      [
        `DataDock account recovery\nUsername: ${session.user?.username}\nRecovery code: ${recovery}\n\nStore privately. This code can reset your password. A reset replaces this code.\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "datadock-recovery.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (recovery)
    return (
      <div className="account-layout recovery-layout">
        <section className="account-card">
          <span className="auth-icon">
            <ShieldCheck size={28} />
          </span>
          <div className="eyebrow">ONE IMPORTANT THING</div>
          <h1>Keep your recovery code safe.</h1>
          <p>
            This is how you reset your password if you forget it. We only show
            this code once.
          </p>
          <code className="recovery-code">{recovery}</code>
          <button className="button secondary full" onClick={download}>
            <Download size={17} />
            Download recovery code
          </button>
          <label className="check-option saved-check">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            <span>I saved this code somewhere private.</span>
          </label>
          <button
            className="button primary full"
            disabled={!saved}
            onClick={() => {
              setRecovery("");
              onContinue();
            }}
          >
            Go to my workspace
            <ArrowRight size={17} />
          </button>
        </section>
      </div>
    );
  if (session.user)
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR ACCOUNT</div>
            <h1>Your work, all together.</h1>
            <p>Sign in on any device to open your saved reports.</p>
          </div>
        </div>
        <section className="profile-card">
          <span className="profile-avatar">
            {session.user.name.slice(0, 2).toUpperCase()}
          </span>
          <h2>{session.user.name}</h2>
          <p>@{session.user.username}</p>
          <div className="profile-details">
            <div>
              <ShieldCheck size={19} />
              <span>Private report history</span>
            </div>
            <div>
              <LockKeyhole size={19} />
              <span>Password-protected account</span>
            </div>
          </div>
          <button className="button primary" onClick={onContinue}>
            Open my workspace
            <ArrowRight size={17} />
          </button>
          <button
            className="text-button logout-button"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            Sign out
          </button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </>
    );
  return (
    <div className="account-layout">
      <section className="account-story">
        <div className="eyebrow">MAKE ROOM FOR YOUR NEXT INSIGHT</div>
        <h1>
          A home for
          <br />
          your data work.
        </h1>
        <p>
          Keep your uploads, findings, and cleaned reports together. Come back
          from any device and pick up where you left off.
        </p>
        <div className="auth-benefits">
          {[
            "Your own private report history",
            "Saved cleaning settings",
            "Access across browsers and devices",
          ].map((t) => (
            <div key={t}>
              <Check size={17} />
              {t}
            </div>
          ))}
        </div>
        <div className="auth-story-note">
          <UserRound size={25} />
          <p>
            Just looking around? You can use DataDock without creating an
            account.
          </p>
        </div>
        <button className="text-button" onClick={onContinue}>
          Continue as a guest
          <ArrowRight size={16} />
        </button>
      </section>
      <section className="account-card">
        <span className="auth-icon">
          <LockKeyhole size={25} />
        </span>
        {mode !== "recover" && (
          <div className="auth-tabs">
            <button
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Create account
            </button>
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Sign in
            </button>
          </div>
        )}
        <h2>
          {mode === "register"
            ? "Start your own workspace."
            : mode === "login"
              ? "Welcome back."
              : "Get back to your workspace."}
        </h2>
        <p>
          {mode === "register"
            ? "No email address needed. Choose a username and password."
            : mode === "login"
              ? "Enter your username and password to continue."
              : "Use the recovery code you saved when you created your account."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="How should we greet you?"
                maxLength={60}
                required
              />
            </label>
          )}
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              placeholder="e.g. alex_research"
              pattern="[a-zA-Z0-9_]{3,32}"
              minLength={3}
              maxLength={32}
              required
            />
            <small>3–32 letters, numbers, or underscores</small>
          </label>
          {mode === "recover" && (
            <label>
              Recovery code
              <input
                name="recovery_code"
                autoComplete="off"
                minLength={20}
                maxLength={100}
                required
              />
            </label>
          )}
          <label>
            {mode === "recover" ? "New password" : "Password"}
            <span className="password-field">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                placeholder={
                  mode === "login" ? "Your password" : "At least 12 characters"
                }
                required
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {
            <label className="check-option">
              <input type="checkbox" name="keep_reports" defaultChecked />
              <span>Keep this browser’s guest reports in my account.</span>
            </label>
          }
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <ArrowRight size={17} />
            )}{" "}
            {busy
              ? "Please wait…"
              : mode === "register"
                ? "Create my account"
                : mode === "login"
                  ? "Sign in"
                  : "Reset password"}
          </button>
        </form>
        {mode === "login" && (
          <button
            className="text-button"
            onClick={() => {
              setMode("recover");
              setError("");
            }}
          >
            Forgot your password?
          </button>
        )}
        {mode === "recover" && (
          <button
            className="text-button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            <ArrowLeft size={14} />
            Back to sign in
          </button>
        )}
        <small className="auth-privacy">
          Your files belong to your workspace. We never show them to other
          users.
        </small>
      </section>
    </div>
  );
}
