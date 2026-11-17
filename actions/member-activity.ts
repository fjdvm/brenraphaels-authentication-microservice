"use server";

import { listMemberActivity } from "@/lib/audit/audit-logs.server";
import { parseSystemLogFilters, type SystemLogsResult } from "@/lib/audit/system-logs-query";
import { requirePortalUser } from "@/lib/auth/session";

/** One page of the Member Activity log for its System, Action and date filters. A failure is a result, never a throw. */
export async function loadMemberActivityAction(filters: unknown): Promise<SystemLogsResult> {
  await requirePortalUser();

  try {
    // The Actor is taken from the session inside listMemberActivity; nothing in `filters` can name one.
    const page = await listMemberActivity(parseSystemLogFilters(filters));

    return { status: "ok", ...page };
  } catch (error) {
    console.error("Failed to read the Activity log", error);

    return { status: "error" };
  }
}
