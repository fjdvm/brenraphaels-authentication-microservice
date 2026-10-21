import { afterEach, describe, expect, it, vi } from "vitest";

import {
  auditGatewayConfig,
  createAuditClient,
  exportSystemLogs,
  readMyLogOptions,
  readMyLogs,
  readSystemLogOptions,
  readSystemLogs,
  SYSTEM_LOG_PAGE_SIZE,
  type UserDirectory,
} from "./audit-logs";
import { AUDIT_ACTIONS } from "./events";

/* eslint-disable @typescript-eslint/no-explicit-any -- request bodies are asserted loosely */
type Call = { url: URL; method: string; headers: Headers; body: Record<string, any> };

function stubService(respond: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: new URL(String(input)),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return respond(call, calls.length);
  };
  return { calls, fetchStub: fetchStub as typeof fetch };
}

const people: Record<string, string> = {
  admin: "Ada Min (2026-ADMIN-001)",
  staff: "Sam Staff (2026-SS-002)",
};
const users: UserDirectory = async (ids) =>
  new Map(ids.filter((id) => people[id]).map((id) => [id, people[id]]));

const created = () => Response.json({ id: "6f0c9a52-3d1e-4c8e-9a53-0f4b8b1d2c77" }, { status: 201 });

function client(respond: Parameters<typeof stubService>[0], overrides: Partial<Parameters<typeof createAuditClient>[0]> = {}) {
  const { calls, fetchStub } = stubService(respond);
  return {
    calls,
    client: createAuditClient({
      baseUrl: "https://audit.test/",
      writeKey: "write-key",
      readKey: "read-key",
      users,
      fetch: fetchStub,
      ...overrides,
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("recording events", () => {
  it("writes a correctly shaped Authentication event with the write key", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff", targetUserId: "staff" });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url.href).toBe("https://audit.test/events");
    expect(calls[0].headers.get("authorization")).toBe("Bearer write-key");
    expect(calls[0].body).toMatchObject({
      source: "Authentication",
      action: "user.logout",
      outcome: "success",
      actor: { type: "user", id: "staff", display_name: "Sam Staff (2026-SS-002)" },
      target: { type: "user", id: "staff", display_name: "Sam Staff (2026-SS-002)" },
      subject: { type: "user", id: "staff", display_name: "Sam Staff (2026-SS-002)" },
    });
    expect(calls[0].body.description).toContain("Sam Staff (2026-SS-002)");
    expect(new Date(calls[0].body.occurred_at).toString()).not.toBe("Invalid Date");
    expect(calls[0].body.idempotency_key).toEqual(expect.any(String));
  });

  it("distinguishes an Administrator acting on another User", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({
      action: "user.delete",
      outcome: "SUCCESS",
      actorId: "admin",
      targetUserId: "staff",
      detail: "Deleted 2026-SS-002",
    });

    expect(calls[0].body).toMatchObject({
      action: "user.deleted",
      actor: { id: "admin", display_name: "Ada Min (2026-ADMIN-001)" },
      target: { id: "staff", display_name: "Sam Staff (2026-SS-002)" },
      subject: { id: "staff" },
    });
    expect(calls[0].body.description).toContain("Ada Min (2026-ADMIN-001)");
    expect(calls[0].body.description).toContain("Sam Staff (2026-SS-002)");
    expect(calls[0].body.description).toContain("Deleted 2026-SS-002");
  });

  it("records an unauthenticated failed sign-in with a placeholder actor (no User id as actor), keeping the attempted account as target", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({ action: "auth.login", outcome: "FAILURE", targetUserId: "staff", detail: "Incorrect password" });

    expect(calls[0].body.action).toBe("user.login_failed");
    expect(calls[0].body.outcome).toBe("failure");
    expect(calls[0].body.actor).toEqual({
      type: "anonymous",
      id: "unauthenticated",
      display_name: "Unauthenticated visitor",
    });
    expect(calls[0].body.target.id).toBe("staff");
  });

  it("records a failed sign-in for an unknown Username without any User", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({ action: "auth.login", outcome: "FAILURE", detail: "Unknown Username" });

    expect(calls[0].body.actor.type).toBe("anonymous");
    expect(calls[0].body.target).toMatchObject({ type: "portal", id: "portal" });
    expect(calls[0].body.subject).toBeUndefined();
  });

  it.each([
    [{ action: "auth.login", outcome: "SUCCESS" }, "user.login"],
    [{ action: "auth.login", outcome: "FAILURE" }, "user.login_failed"],
    [{ action: "auth.logout", outcome: "SUCCESS" }, "user.logout"],
    [{ action: "auth.password_change", outcome: "SUCCESS" }, "password.changed"],
    [{ action: "auth.password_reset_request", outcome: "SUCCESS" }, "password.forgot_requested"],
    [{ action: "auth.password_reset", outcome: "SUCCESS" }, "password.forgot_completed"],
    [{ action: "user.create", outcome: "SUCCESS" }, "user.created"],
    [{ action: "user.delete", outcome: "SUCCESS" }, "user.deleted"],
    [{ action: "user.restore", outcome: "SUCCESS" }, "user.restored"],
    [{ action: "user.resend_credentials", outcome: "SUCCESS" }, "credentials.resent"],
    [{ action: "user.role_change", outcome: "SUCCESS" }, "user.role_changed"],
    [{ action: "access.grant", outcome: "SUCCESS" }, "access_grant.granted"],
    [{ action: "access.revoke", outcome: "SUCCESS" }, "access_grant.revoked"],
    [{ action: "user.access_update", outcome: "FAILURE" }, "access_grant.granted"],
    [{ action: "integration.authorize", outcome: "SUCCESS" }, "system.handoff_authorized"],
    [{ action: "integration.exchange", outcome: "SUCCESS" }, "system.handoff_exchanged"],
    [{ action: "integration.validate", outcome: "FAILURE" }, "system.handoff_denied"],
  ] as const)("maps %j to the catalog action %s", async (event, catalogAction) => {
    const { calls, client: audit } = client(created);

    await audit.record({ ...event, actorId: "admin" });

    expect(calls[0].body.action).toBe(catalogAction);
  });

  it("covers every Portal action", async () => {
    const { calls, client: audit } = client(created);

    for (const action of AUDIT_ACTIONS) {
      await audit.record({ action, outcome: "SUCCESS", actorId: "admin" });
    }

    expect(calls).toHaveLength(AUDIT_ACTIONS.length);
    expect(calls.every((call) => typeof call.body.action === "string")).toBe(true);
  });

  it("retries once with the same idempotency key after a server error", async () => {
    const { calls, client: audit } = client((_call, n) =>
      n === 1 ? Response.json({ error: "Internal server error" }, { status: 500 }) : created(),
    );

    await audit.record({ action: "auth.login", outcome: "SUCCESS", actorId: "staff" });

    expect(calls).toHaveLength(2);
    expect(calls[1].body.idempotency_key).toBe(calls[0].body.idempotency_key);
  });

  it("retries once after a network failure or timeout", async () => {
    let attempts = 0;
    const fetchStub = (async () => {
      attempts += 1;
      if (attempts === 1) throw new DOMException("timed out", "TimeoutError");
      return created();
    }) as typeof fetch;
    const audit = createAuditClient({ baseUrl: "https://audit.test", writeKey: "w", readKey: "r", users, fetch: fetchStub });

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff" });

    expect(attempts).toBe(2);
  });

  it("uses a fresh idempotency key for each event", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff" });
    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff" });

    expect(calls[0].body.idempotency_key).not.toBe(calls[1].body.idempotency_key);
  });

  it("never throws, and gives up after the one retry", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, client: audit } = client(() => Response.json({ error: "down" }, { status: 503 }));

    await expect(audit.record({ action: "auth.login", outcome: "SUCCESS", actorId: "staff" })).resolves.toBeUndefined();

    expect(calls).toHaveLength(2);
    expect(error).toHaveBeenCalled();
  });

  it("never throws when the service is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const audit = createAuditClient({
      baseUrl: "https://audit.test",
      writeKey: "w",
      readKey: "r",
      users,
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });

    await expect(audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff" })).resolves.toBeUndefined();
  });

  it("does not retry a rejected event", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, client: audit } = client(() => Response.json({ error: "Invalid Audit Event" }, { status: 400 }));

    await audit.record({ action: "auth.login", outcome: "SUCCESS", actorId: "staff" });

    expect(calls).toHaveLength(1);
  });

  it("still records when the User lookup fails, falling back to the id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, client: audit } = client(created, {
      users: async () => {
        throw new Error("db down");
      },
    });

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff", targetUserId: "staff" });

    expect(calls).toHaveLength(1);
    expect(calls[0].body.actor).toMatchObject({ id: "staff", display_name: "staff" });
  });

  it("stops waiting for a slow User lookup and records with the id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, client: audit } = client(created, {
      timeoutMs: 20,
      users: () => new Promise(() => {}),
    });

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff", targetUserId: "staff" });

    expect(calls[0].body.actor.display_name).toBe("staff");
  });

  it("redacts credential-looking material from the description", async () => {
    const { calls, client: audit } = client(created);

    await audit.record({
      action: "auth.password_reset",
      outcome: "FAILURE",
      detail: "bad token=abc123 and password: hunter2 Bearer eyJhbGciOi.x.y",
    });

    expect(calls[0].body.description).not.toMatch(/abc123|hunter2|eyJhbGciOi/);
  });

  it("passes request context through when given", async () => {
    const { calls, client: audit } = client(created);

    await audit.record(
      { action: "auth.logout", outcome: "SUCCESS", actorId: "staff" },
      { ipAddress: "203.0.113.9", userAgent: "TestAgent/1.0", requestId: "req-1" },
    );

    expect(calls[0].body).toMatchObject({ ip_address: "203.0.113.9", user_agent: "TestAgent/1.0", request_id: "req-1" });
  });
});

describe("listing events", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: "e1",
    source: "Authentication",
    module: null,
    action: "user.login",
    outcome: "success",
    actor: { type: "user", id: "admin", display_name: "Ada Min (2026-ADMIN-001)" },
    target: { type: "user", id: "admin", display_name: "Ada Min (2026-ADMIN-001)" },
    subject: null,
    description: "Ada Min signed in.",
    occurred_at: "2026-10-06T01:00:00.000000Z",
    recorded_at: "2026-10-06T01:00:01.000000Z",
    ...over,
  });

  it("reads newest first with the read key and maps events for the page", async () => {
    const { calls, client: audit } = client(() =>
      Response.json({
        events: [
          row(),
          row({
            id: "e2",
            source: "CRMS",
            action: "record.created",
            outcome: "failure",
            actor: { type: "anonymous", id: "unauthenticated", display_name: "Unauthenticated visitor" },
            description: "Something failed.",
          }),
        ],
        next_cursor: "abc",
      }),
    );

    const page = await audit.listPage({ limit: 25 });

    expect(calls[0].method).toBe("GET");
    expect(calls[0].url.pathname).toBe("/events");
    expect(calls[0].url.searchParams.get("limit")).toBe("25");
    expect(calls[0].headers.get("authorization")).toBe("Bearer read-key");
    expect(page.nextCursor).toBe("abc");
    expect(page.entries[0]).toEqual({
      id: "e1",
      occurredAt: new Date("2026-10-06T01:00:00.000Z"),
      system: "Portal",
      action: "Signed in",
      actionValue: "user.login",
      actor: "Ada Min (2026-ADMIN-001)",
      target: "Ada Min (2026-ADMIN-001)",
      outcome: "SUCCESS",
      description: "Ada Min signed in.",
    });
    expect(page.entries[1]).toMatchObject({ system: "CRMS", action: "record.created", outcome: "FAILURE" });
  });

  it("sends each filter and the cursor to the service, and only those set", async () => {
    const { calls, client: audit } = client(() => Response.json({ events: [], next_cursor: null }));

    await audit.listPage({
      limit: 50,
      q: "  ada ",
      from: "2026-10-01T00:00:00+08:00",
      to: "2026-10-07T23:59:59.999+08:00",
      action: "user.login",
      outcome: "FAILURE",
      source: "Authentication",
      cursor: "abc",
    });
    await audit.listPage({ limit: 50, q: "   " });

    const first = calls[0].url.searchParams;
    expect(Object.fromEntries(first)).toEqual({
      limit: "50",
      q: "ada",
      from: "2026-10-01T00:00:00+08:00",
      to: "2026-10-07T23:59:59.999+08:00",
      action: "user.login",
      outcome: "failure",
      source: "Authentication",
      cursor: "abc",
    });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ limit: "50" });
  });

  it("keeps a path prefix in the base URL, so it can be reached through the api-gateway's /audit", async () => {
    const { calls, client: audit } = client(() => Response.json({ events: [], next_cursor: null }), {
      baseUrl: "https://gateway.test/audit/",
    });

    await audit.listPage({ limit: 50 });

    expect(calls[0].url.origin).toBe("https://gateway.test");
    expect(calls[0].url.pathname).toBe("/audit/events");
  });

  it("rejects when the service cannot be read, so the page shows its error", async () => {
    const { client: audit } = client(() => Response.json({ error: "Invalid API key" }, { status: 401 }));

    await expect(audit.listPage({ limit: 25 })).rejects.toThrow("401");
  });
});

describe("filter options", () => {
  const catalog = {
    sources: [
      { source: "CRMS", modules: ["Tickets"], actions: ["record.created"] },
      { source: "Authentication", modules: [], actions: ["user.login", "user.login_failed", "audit_log.exported", "future.thing"] },
    ],
  };

  it("lists every Source, labelling Authentication as Portal, with each Source's actions", async () => {
    const { calls, client: audit } = client(() => Response.json(catalog));

    const options = await audit.filterOptions();

    expect(calls[0].url.pathname).toBe("/events/valid-values");
    expect(calls[0].headers.get("authorization")).toBe("Bearer read-key");
    expect(options.systems).toEqual([
      { value: "CRMS", label: "CRMS" },
      { value: "Authentication", label: "Portal" },
    ]);
    expect(options.actions).toEqual([
      { value: "record.created", label: "record.created", systems: ["CRMS"] },
      { value: "user.login", label: "Signed in", systems: ["Authentication"] },
      { value: "user.login_failed", label: "Failed sign-in", systems: ["Authentication"] },
      { value: "audit_log.exported", label: "Exported System logs", systems: ["Authentication"] },
      { value: "future.thing", label: "future.thing", systems: ["Authentication"] },
    ]);
  });

  it("rejects when the service cannot be read", async () => {
    const { client: audit } = client(() => new Response("nope", { status: 500 }));

    await expect(audit.filterOptions()).rejects.toThrow("500");
  });
});

describe("reading System logs", () => {
  const events = () => Response.json({ events: [], next_cursor: null });

  it("lists for an Administrator", async () => {
    const { calls, client: audit } = client(events);

    await expect(readSystemLogs(audit, { isAdministrator: true }, { q: "ada", cursor: "c1" })).resolves.toEqual({
      entries: [],
      nextCursor: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url.searchParams.get("limit")).toBe(String(SYSTEM_LOG_PAGE_SIZE));
    expect(calls[0].url.searchParams.get("q")).toBe("ada");
    expect(calls[0].url.searchParams.get("cursor")).toBe("c1");
  });

  it.each([
    ["signed out", null],
    ["not an Administrator (or demoted)", { isAdministrator: false }],
  ])("refuses when %s, without calling the service", async (_label, viewer) => {
    const { calls, client: audit } = client(events);

    await expect(readSystemLogs(audit, viewer, {})).rejects.toThrow("Administrators only");
    expect(calls).toHaveLength(0);
  });
});

describe("reading the filter options", () => {
  it.each([
    ["signed out", null],
    ["not an Administrator", { isAdministrator: false }],
  ])("refuses when %s, without calling the service", async (_label, viewer) => {
    const { calls, client: audit } = client(() => Response.json({ sources: [] }));

    await expect(readSystemLogOptions(audit, viewer)).rejects.toThrow("Administrators only");
    expect(calls).toHaveLength(0);
  });
});

describe("through the api-gateway", () => {
  const env = {
    API_GATEWAY_URL: "https://gateway.test/",
    API_GATEWAY_KEY: "portal-caller-key",
    API_GATEWAY_AUDIT_READ_KEY: "audit-reader-caller-key",
  };

  it("writes and reads under the gateway's /audit prefix, each with its own Caller key", async () => {
    const { calls, fetchStub } = stubService((call) =>
      call.method === "POST" ? created() : Response.json({ events: [], next_cursor: null }),
    );
    const audit = createAuditClient({ ...auditGatewayConfig(env), users, fetch: fetchStub });

    await audit.record({ action: "auth.logout", outcome: "SUCCESS", actorId: "staff", targetUserId: "staff" });
    await audit.listPage({ limit: 25 });

    expect(calls.map((call) => `${call.method} ${call.url.origin}${call.url.pathname}`)).toEqual([
      "POST https://gateway.test/audit/events",
      "GET https://gateway.test/audit/events",
    ]);
    expect(calls[0].headers.get("authorization")).toBe("Bearer portal-caller-key");
    expect(calls[1].headers.get("authorization")).toBe("Bearer audit-reader-caller-key");
  });

  it("is unconfigured, so every call fails, when the gateway URL is missing", () => {
    expect(auditGatewayConfig({}).baseUrl).toBe("");
  });

  it("waits longer for a read than for a write, so a slow page load is not reported as an outage", async () => {
    const slow = (after: number, response: () => Response) =>
      ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(response()), after);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("timed out", "TimeoutError"));
          });
        })) as typeof fetch;
    const audit = createAuditClient({
      baseUrl: "https://gateway.test/audit",
      writeKey: "w",
      readKey: "r",
      users,
      timeoutMs: 20,
      readTimeoutMs: 500,
      fetch: slow(60, () => Response.json({ events: [], next_cursor: null })),
    });

    await expect(audit.listPage({ limit: 25 })).resolves.toEqual({ entries: [], nextCursor: null });
  });
});

describe("exporting System logs", () => {
  const range = { from: "2026-10-15T00:00:00.000+08:00", to: "2026-10-21T23:59:59.999+08:00" };
  const admin = { id: "admin", firstName: "Ada", lastName: "Min", username: "2026-ADMIN-001", isAdministrator: true };
  const csv = () =>
    new Response("id,source\r\n1,Authentication\r\n", {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });

  it("asks for CSV with the read key, the screen's filters and the requesting Administrator", async () => {
    const { calls, client: audit } = client(csv);

    const result = await exportSystemLogs(audit, admin, {
      ...range,
      q: " ada ",
      action: "user.login",
      outcome: "FAILURE",
      source: "Authentication",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url.pathname).toBe("/events/export");
    expect(calls[0].headers.get("authorization")).toBe("Bearer read-key");
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      format: "csv",
      from: range.from,
      to: range.to,
      q: "ada",
      action: "user.login",
      outcome: "failure",
      source: "Authentication",
      requested_by_id: "admin",
      requested_by_name: "Ada Min (2026-ADMIN-001)",
    });
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && (await new Response(result.body).text())).toBe("id,source\r\n1,Authentication\r\n");
  });

  it("sends only the filters that are set, and never a cursor or limit", async () => {
    const { calls, client: audit } = client(csv);

    await audit.exportCsv({ ...range, q: "", action: undefined }, { id: "admin", name: "Ada" });

    expect([...calls[0].url.searchParams.keys()].sort()).toEqual(
      ["format", "from", "requested_by_id", "requested_by_name", "to"].sort(),
    );
  });

  it("reports an export over the service's cap without a body", async () => {
    const { client: audit } = client(() =>
      Response.json({ error: "Export matches 60000 events, more than 50000 rows.", row_count: 60000, limit: 50000 }, { status: 413 }),
    );

    await expect(audit.exportCsv(range, { id: "admin", name: "Ada" })).resolves.toEqual({ status: "too_large" });
  });

  it("rejects when the service cannot be read", async () => {
    const { client: audit } = client(() => new Response(null, { status: 502 }));

    await expect(audit.exportCsv(range, { id: "admin", name: "Ada" })).rejects.toThrow("502");
  });

  it.each([
    ["signed out", null],
    ["not an Administrator", { ...admin, isAdministrator: false }],
  ])("refuses when %s, without calling the service", async (_label, viewer) => {
    const { calls, client: audit } = client(csv);

    await expect(exportSystemLogs(audit, viewer, range)).rejects.toThrow("Administrators only");
    expect(calls).toHaveLength(0);
  });
});

describe("reading My Logs", () => {
  const events = () => Response.json({ events: [], next_cursor: null });

  it("asks only for events the signed-in User performed, with the screen's filters", async () => {
    const { calls, client: audit } = client(events);

    await readMyLogs(audit, { id: "staff" }, { q: "signed", action: "user.login", source: "Authentication", cursor: "c1" });

    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      limit: String(SYSTEM_LOG_PAGE_SIZE),
      q: "signed",
      action: "user.login",
      source: "Authentication",
      cursor: "c1",
      actor_type: "user",
      actor_id: "staff",
    });
  });

  it("filters by Actor, so events an Administrator performed on the User are not asked for", async () => {
    const { calls, client: audit } = client(events);

    await readMyLogs(audit, { id: "staff" }, {});

    const params = calls[0].url.searchParams;
    expect(params.get("actor_id")).toBe("staff");
    expect(params.has("subject_id")).toBe(false);
    expect(params.has("target_id")).toBe(false);
  });

  it("cannot be widened to another User by anything in the filters", async () => {
    const { calls, client: audit } = client(events);
    const widened = { actor: { type: "user", id: "admin" }, actor_id: "admin", actor_type: "anonymous", subject_id: "admin" };

    await readMyLogs(audit, { id: "staff" }, widened as never);

    const params = calls[0].url.searchParams;
    expect(params.getAll("actor_id")).toEqual(["staff"]);
    expect(params.getAll("actor_type")).toEqual(["user"]);
    expect(params.has("subject_id")).toBe(false);
  });

  it("refuses when signed out or without a User id, without calling the service", async () => {
    const { calls, client: audit } = client(events);

    await expect(readMyLogs(audit, null, {})).rejects.toThrow("sign in required");
    await expect(readMyLogs(audit, { id: "" }, {})).rejects.toThrow("sign in required");
    await expect(readMyLogOptions(audit, null)).rejects.toThrow("sign in required");
    expect(calls).toHaveLength(0);
  });

  it("is open to every signed-in User, not only Administrators", async () => {
    const { calls, client: audit } = client((call) =>
      call.url.pathname === "/events/valid-values" ? Response.json({ sources: [] }) : events(),
    );

    await expect(readMyLogs(audit, { id: "staff" }, {})).resolves.toEqual({ entries: [], nextCursor: null });
    await expect(readMyLogOptions(audit, { id: "staff" })).resolves.toEqual({ systems: [], actions: [] });
    expect(calls).toHaveLength(2);
  });
});
