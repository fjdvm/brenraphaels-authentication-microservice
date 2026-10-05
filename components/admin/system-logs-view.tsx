import { Badge } from "@/components/ui/badge";
import type { SystemLogEntry } from "@/lib/audit/system-log";

const timestamp = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

/** `entries` is null when the log could not be read. */
export function SystemLogsView({ entries }: { entries: SystemLogEntry[] | null }) {
  if (entries === null) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Couldn&apos;t load System Logs</p>
        <p className="mt-1 text-on-surface-variant">Refresh the page to try again.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm">
        <p className="font-medium text-primary">No activity recorded yet</p>
        <p className="mt-1 text-on-surface-variant">
          Sign-ins, sign-outs and password activity will appear here.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="System Logs" className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-220 text-left text-sm">
          <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-6 py-3 font-medium" scope="col">Time (UTC)</th>
              <th className="px-6 py-3 font-medium" scope="col">Actor</th>
              <th className="px-6 py-3 font-medium" scope="col">Action</th>
              <th className="px-6 py-3 font-medium" scope="col">Target</th>
              <th className="px-6 py-3 font-medium" scope="col">Outcome</th>
              <th className="px-6 py-3 font-medium" scope="col">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-6 py-4 text-on-surface-variant">
                  <time dateTime={entry.occurredAt.toISOString()}>
                    {timestamp.format(entry.occurredAt)}
                  </time>
                </td>
                <td className="px-6 py-4 text-foreground">{entry.actor ?? "Unknown"}</td>
                <td className="whitespace-nowrap px-6 py-4 text-foreground">{entry.action}</td>
                <td className="px-6 py-4 text-on-surface-variant">{entry.target ?? "—"}</td>
                <td className="whitespace-nowrap px-6 py-4">
                  <Badge variant={entry.outcome === "SUCCESS" ? "default" : "destructive"}>
                    {entry.outcome === "SUCCESS" ? "Success" : "Failed"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-on-surface-variant">{entry.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
