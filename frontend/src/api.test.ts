import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api, startSession } from "./api";
describe("session-aware API client", () => {
  const request = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", request);
    request.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());
  it("uses the server session token on writes and keeps same-origin credentials", async () => {
    request.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ csrf_token: "session-csrf", storage: "local" }),
      ),
    );
    await startSession();
    request.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    await api("/reports/report-id/clean", {
      method: "POST",
      body: JSON.stringify({ trim_whitespace: true }),
    });
    const [url, options] = request.mock.calls[1];
    expect(url).toBe("/api/reports/report-id/clean");
    expect(options.credentials).toBe("same-origin");
    expect(options.headers.get("X-CSRF-Token")).toBe("session-csrf");
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });
  it("preserves actionable server errors", async () => {
    request.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "This report was not found in your workspace.",
        }),
        { status: 404 },
      ),
    );
    await expect(api("/reports/unknown")).rejects.toThrow(
      "not found in your workspace",
    );
  });
  it("rotates the write token after account sign-in", async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({csrf_token: "guest"})));
    await startSession();
    request.mockResolvedValueOnce(new Response(JSON.stringify({csrf_token: "signed-in", user: {username: "analyst"}})));
    await api("/auth/login", {method: "POST", body: JSON.stringify({username: "analyst", password: "test-only-password"})});
    request.mockResolvedValueOnce(new Response(JSON.stringify({ok: true})));
    await api("/reports/id/clean", {method: "POST", body: "{}"});
    expect(request.mock.calls[2][1].headers.get("X-CSRF-Token")).toBe("signed-in");
  });
  it("handles a proxy HTML error without leaking markup into the UI", async () => {
    request.mockResolvedValue(
      new Response("<html>upstream failed</html>", { status: 502 }),
    );
    await expect(api("/reports")).rejects.toThrow(
      "The request could not be completed",
    );
  });
});
