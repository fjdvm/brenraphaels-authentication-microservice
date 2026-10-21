"use server";

import { listSystemLogEvents } from "@/lib/audit/audit-logs.server";
import { parseSystemLogFilters, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requireAdministrator } from "@/lib/auth/session";

/** One page of the System logs for the screen's filters, paging and Retry. A failure is a result, never a throw. */
export async function loadSystemLogsAction(filters: unknown): Promise<SystemLogsResult> {
  // Authority is re-checked against the live Role on every call.
  await requireAdministrator();

  try {
    const page = await listSystemLogEvents(parseSystemLogFilters(filters));

    return { status: "ok", ...page };
  } catch (error) {
    console.error("Failed to read System Logs", error);

    return { status: "error" };
  }
}
