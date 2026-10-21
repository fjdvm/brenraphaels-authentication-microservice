import { createNotificationsClient, createNotifier, type Notifier } from "./notifications";

type Sent = { type: string; title: string; body: string; userIds: string[] };

/**
 * A notifier wired to a stubbed notifications API over HTTP. `sent` holds what the
 * service received; `down` makes every request fail as if the service were unreachable.
 */
export function stubNotificationsService(options: { down?: boolean } = {}): { notify: Notifier; sent: Sent[] } {
  const sent: Sent[] = [];
  const client = createNotificationsClient({
    baseUrl: "https://gateway.test",
    callerKey: "caller-key",
    app: "Portal",
    fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (options.down) throw new TypeError("fetch failed");
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ stored: 1, connected: 0 }, { status: 201 });
    }) as typeof fetch,
  });

  return { notify: createNotifier(client), sent };
}
