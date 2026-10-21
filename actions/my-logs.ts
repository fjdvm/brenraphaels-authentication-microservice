"use server";

import { listMyLogEvents } from "@/lib/audit/audit-logs.server";
import { parseSystemLogFilters, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requirePortalUser } from "@/lib/auth/session";

/** One page of My Logs for the screen's filters, paging and Retry. A failure is a result, never a throw. */
export async function loadMyLogsAction(filters: unknown): Promise<SystemLogsResult> {
  await requirePortalUser();

  try {
    // The Actor is taken from the session inside listMyLogEvents; nothing in `filters` can name one.
    const page = await listMyLogEvents(parseSystemLogFilters(filters));

    return { status: "ok", ...page };
  } catch (error) {
    console.error("Failed to read My Logs", error);

    return { status: "error" };
  }
}
