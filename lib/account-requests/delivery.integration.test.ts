import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { deliverStatus } from "./delivery";

it("pushes to a fake HRMS receiver, retains failures, and retries until acknowledged", async () => {
  const received: unknown[] = [];
  const authorizations: (string | undefined)[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    received.push(JSON.parse(body));
    authorizations.push(request.headers.authorization);
    response.writeHead(received.length < 3 ? 503 : 200).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing receiver address");
  const queued: (() => Promise<void>)[] = [];
  const acknowledged: string[] = [];
  const payload = { reference: "RQ-0001", status: "account_created", actor: "admin", occurredAt: "2026-11-13T00:00:00.000Z" };
  const ports = {
    send: (body: unknown) => fetch(`http://127.0.0.1:${address.port}`, { method: "POST", headers: { authorization: "Bearer system-secret" }, body: JSON.stringify(body) }),
    acknowledge: async (id: string) => { acknowledged.push(id); },
    later: (run: () => Promise<void>) => { queued.push(run); },
  };
  try {
    await deliverStatus({ id: "delivery", payload }, ports);
    expect(acknowledged).toEqual([]);
    await queued[0]();
    expect(acknowledged).toEqual([]);
    await queued[1]();
    expect(acknowledged).toEqual(["delivery"]);
    expect(received).toEqual([payload, payload, payload]);
    expect(authorizations).toEqual(["Bearer system-secret", "Bearer system-secret", "Bearer system-secret"]);
    expect(queued).toHaveLength(2);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
