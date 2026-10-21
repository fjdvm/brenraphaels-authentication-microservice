import { describe, expect, it, vi } from "vitest";

import type { AuditExport } from "./audit-logs";
import { EXPORT_TOO_LARGE_MESSAGE, handleSystemLogsExport } from "./system-logs-export";

const admin = { isAdministrator: true, mustChangePassword: false };
const from = "2026-10-15T00:00:00.000+08:00";
const to = "2026-10-21T23:59:59.999+08:00";

function setup(
  viewer: { isAdministrator: boolean; mustChangePassword: boolean } | null = admin,
  result: AuditExport | Error = { status: "ok", body: new Response("id\r\n1\r\n").body! },
) {
  const exportCsv = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { exportCsv, deps: { resolveViewer: async () => viewer, exportCsv } };
}

const url = (params: Record<string, string>) =>
  new URL(`https://portal.test/api/system-logs/export?${new URLSearchParams(params)}`);

describe("System logs export endpoint", () => {
  it("streams the CSV for the screen's filters and date range", async () => {
    const { deps, exportCsv } = setup();

    const response = await handleSystemLogsExport(
      deps,
      url({ from, to, q: "ada", action: "user.login", outcome: "FAILURE", source: "Authentication", cursor: "c2" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="system-logs_2026-10-15_2026-10-21.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("id\r\n1\r\n");
    // The page's cursor never narrows an export to one page.
    expect(exportCsv).toHaveBeenCalledWith({
      from,
      to,
      q: "ada",
      action: "user.login",
      outcome: "FAILURE",
      source: "Authentication",
    });
  });

  it("answers 413 with the narrow-the-range message over the cap", async () => {
    const { deps } = setup(admin, { status: "too_large" });

    const response = await handleSystemLogsExport(deps, url({ from, to }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: EXPORT_TOO_LARGE_MESSAGE });
    expect(EXPORT_TOO_LARGE_MESSAGE).toMatch(/narrow the date range/i);
  });

  it.each([
    ["signed out", null, 401],
    ["not an Administrator", { isAdministrator: false, mustChangePassword: false }, 403],
    ["an Administrator who must change their password", { isAdministrator: true, mustChangePassword: true }, 403],
  ])("refuses when %s, without calling the service", async (_label, viewer, status) => {
    const { deps, exportCsv } = setup(viewer);

    const response = await handleSystemLogsExport(deps, url({ from, to }));

    expect(response.status).toBe(status);
    expect(exportCsv).not.toHaveBeenCalled();
  });

  it("requires both dates, since the service exports a bounded range only", async () => {
    const { deps, exportCsv } = setup();

    const response = await handleSystemLogsExport(deps, url({ from }));

    expect(response.status).toBe(400);
    expect(exportCsv).not.toHaveBeenCalled();
  });

  it("answers 502 when the service cannot be read", async () => {
    const { deps } = setup(admin, new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSystemLogsExport(deps, url({ from, to }));

    expect(response.status).toBe(502);
  });
});
