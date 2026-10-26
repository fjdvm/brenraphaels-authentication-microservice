import type { AuditExport, AuditExportFilters } from "./audit-logs";
import { parseSystemLogFilters } from "./system-logs-query";

type Viewer = { isAdministrator: boolean; mustChangePassword: boolean };

type Deps = {
  /** The signed-in User, resolved from the session. Never taken from the request. */
  resolveViewer: () => Promise<Viewer | null>;
  exportCsv: (filters: AuditExportFilters) => Promise<AuditExport>;
};

/** What the Export CSV button shows when the service refuses an export over its cap. */
export const EXPORT_TOO_LARGE_MESSAGE = "Too many events to export. Narrow the date range and try again.";

const NO_STORE = { "Cache-Control": "no-store" };

function json(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/**
 * The System logs Export CSV: the screen's filters and date range, streamed from the
 * audit-logs service through the Portal's server so its key never reaches the browser.
 */
export async function handleSystemLogsExport(deps: Deps, url: URL): Promise<Response> {
  const viewer = await deps.resolveViewer();

  if (!viewer) {
    return json("Unauthorized", 401);
  }

  if (!viewer.isAdministrator || viewer.mustChangePassword) {
    return json("Administrators only", 403);
  }

  // Any cursor is ignored: an export covers every page of the shown filters.
  const { q, from, to, action, outcome, source, module } = parseSystemLogFilters(Object.fromEntries(url.searchParams));

  if (!from || !to) {
    return json("Choose a From and To date to export", 400);
  }

  let result: AuditExport;
  try {
    result = await deps.exportCsv({ q, from, to, action, outcome, source, module });
  } catch (error) {
    console.error("Failed to export System Logs", error);

    return json("System logs couldn't be exported right now", 502);
  }

  if (result.status === "too_large") {
    return json(EXPORT_TOO_LARGE_MESSAGE, 413);
  }

  return new Response(result.body, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="system-logs_${from.slice(0, 10)}_${to.slice(0, 10)}.csv"`,
    },
  });
}
