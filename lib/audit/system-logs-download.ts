import type { AuditLogFilters } from "./audit-logs";

export type ExportOutcome = { status: "ok" } | { status: "too_large" } | { status: "error" };

export const EXPORT_PATH = "/api/system-logs/export";

const FALLBACK_FILENAME = "system-logs.csv";

function filename(disposition: string | null): string {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? FALLBACK_FILENAME;
}

function save(file: Blob, name: string) {
  const href = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has started the download, not before.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

/**
 * Asks the Portal's server for the CSV and saves it. Read in full before saving, so an
 * export the service refuses (over its cap) shows a message and downloads nothing.
 */
export async function downloadSystemLogsCsv(query: AuditLogFilters): Promise<ExportOutcome> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (name !== "cursor" && typeof value === "string" && value) params.set(name, value);
  }

  try {
    const response = await fetch(`${EXPORT_PATH}?${params}`, { cache: "no-store" });

    if (response.status === 413) return { status: "too_large" };
    if (!response.ok) return { status: "error" };

    save(await response.blob(), filename(response.headers.get("content-disposition")));

    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}
