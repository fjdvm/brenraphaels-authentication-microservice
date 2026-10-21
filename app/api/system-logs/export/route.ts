import { exportSystemLogEvents } from "@/lib/audit/audit-logs.server";
import { handleSystemLogsExport } from "@/lib/audit/system-logs-export";
import { getPortalUser } from "@/lib/auth/session";

export function GET(request: Request): Promise<Response> {
  return handleSystemLogsExport(
    { resolveViewer: getPortalUser, exportCsv: exportSystemLogEvents },
    new URL(request.url),
  );
}
