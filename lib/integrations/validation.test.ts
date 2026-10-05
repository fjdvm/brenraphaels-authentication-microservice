import { createHash, randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { handleAuthorize, handleExchange, handleValidate, type EndpointDeps } from "./endpoints";
import type {
  HandoffCodeRecord,
  HandoffPorts,
  IntegrationSessionRecord,
  RegisteredSystem,
} from "./handoff";
import { buildSystemRegistration } from "./registration";
import type { StoredIntegrationSession, ValidationPorts } from "./validation";

const SYSTEM_NAMES = ["CRMS", "HRMS", "POS", "IMS"] as const;
const STATE = "correlation-state-0123456789";
const callbackOf = (name: string) => `https://${name.toLowerCase()}.example.com/auth/callback`;

type World = {
  now: Date;
  systems: RegisteredSystem[];
  eligible: Set<string>;
  /** `${userId}:${systemId}:${moduleName}` */
  grants: Set<string>;
  liveSessions: Set<string>;
  codes: (HandoffCodeRecord & { consumed: boolean })[];
  sessions: StoredIntegrationSession[];
  audit: { action: string; outcome: string; targetUserId?: string | null; detail: string }[];
  /** What a stale browser cookie / signed identity token would still say. Never consulted. */
  staleCachedSession: { valid: true };
  outage: boolean;
};

function createWorld() {
  const secrets: Record<string, string> = {};
  const systems: RegisteredSystem[] = SYSTEM_NAMES.map((name) => {
    const { registration, secret } = buildSystemRegistration([callbackOf(name)]);
    secrets[name] = secret;

    return { id: `sys-${name}`, name, ...registration };
  });

  const world: World = {
    now: new Date("2026-10-07T10:00:00Z"),
    systems,
    eligible: new Set(["user-1"]),
    grants: new Set(),
    liveSessions: new Set(["neon-session-1"]),
    codes: [],
    sessions: [],
    audit: [],
    staleCachedSession: { valid: true },
    outage: false,
  };

  for (const name of SYSTEM_NAMES) {
    world.grants.add(`user-1:sys-${name}:Dashboard`);
  }
  world.grants.add("user-1:sys-CRMS:Customer Profiles");

  const guard = () => {
    if (world.outage) {
      throw new Error("provider unreachable");
    }
  };

  const ports: HandoffPorts & ValidationPorts = {
    async findSystemByName(name) {
      guard();

      return world.systems.find((system) => system.name === name) ?? null;
    },
    async isUserEligible(userId) {
      guard();

      return world.eligible.has(userId);
    },
    async hasActiveGrantInSystem(userId, systemId) {
      guard();

      return [...world.grants].some((grant) => grant.startsWith(`${userId}:${systemId}:`));
    },
    async hasActiveGrantInModule(userId, systemId, moduleName) {
      guard();

      return world.grants.has(`${userId}:${systemId}:${moduleName}`);
    },
    async isCentralSessionActive(id) {
      guard();

      return world.liveSessions.has(id);
    },
    async saveCode(record) {
      world.codes.push({ ...record, consumed: false });
    },
    async consumeCode(codeHash, systemId, now) {
      const code = world.codes.find(
        (candidate) =>
          candidate.codeHash === codeHash &&
          candidate.systemId === systemId &&
          !candidate.consumed &&
          candidate.expiresAt > now,
      );

      if (!code) {
        return null;
      }

      code.consumed = true;

      return code;
    },
    async saveSession(record: IntegrationSessionRecord) {
      world.sessions.push({ ...record, revokedAt: null });
    },
    async findIntegrationSession(handleHash) {
      guard();

      return world.sessions.find((session) => session.handleHash === handleHash) ?? null;
    },
    now: () => world.now,
  };

  const deps: EndpointDeps & { ports: HandoffPorts & ValidationPorts } = {
    ports,
    audit: async (event) => {
      world.audit.push(event);
    },
    resolveSubject: async () => ({
      status: "ok",
      userId: "user-1",
      neonSessionId: "neon-session-1",
    }),
  };

  return { world, deps, ports, secrets };
}

function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");

  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

function basic(system: string, secret: string) {
  return `Basic ${Buffer.from(`${system}:${secret}`).toString("base64")}`;
}

describe("live session and Module validation", () => {
  let ctx: ReturnType<typeof createWorld>;

  beforeEach(() => {
    ctx = createWorld();
  });

  /** The full browser + backend handoff, as a System would run it. Returns the handle. */
  async function signInTo(system: (typeof SYSTEM_NAMES)[number]): Promise<string> {
    const pkce = pkcePair();
    const url = new URL("https://portal.example.com/api/integrations/authorize");
    url.searchParams.set("system", system);
    url.searchParams.set("redirect_uri", callbackOf(system));
    url.searchParams.set("state", STATE);
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const redirect = await handleAuthorize(new Request(url), ctx.deps);
    expect(redirect.status).toBe(302);
    const code = new URL(redirect.headers.get("location")!).searchParams.get("code");

    const exchanged = await handleExchange(
      new Request("https://portal.example.com/api/integrations/exchange", {
        method: "POST",
        headers: { Authorization: basic(system, ctx.secrets[system]) },
        body: JSON.stringify({
          code,
          code_verifier: pkce.verifier,
          redirect_uri: callbackOf(system),
          state: STATE,
        }),
      }),
      ctx.deps,
    );
    expect(exchanged.status).toBe(200);

    return (await exchanged.json()).handle;
  }

  function validate(
    handle: string,
    module: string | null = "Dashboard",
    system: (typeof SYSTEM_NAMES)[number] = "CRMS",
    secret: string = ctx.secrets[system],
  ) {
    return handleValidate(
      new Request("https://portal.example.com/api/integrations/validate", {
        method: "POST",
        headers: { Authorization: basic(system, secret) },
        body: JSON.stringify({ handle, ...(module === null ? {} : { module }) }),
      }),
      ctx.deps,
    );
  }

  async function expectDenied(response: Response, status: number, error: string) {
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(response.headers.get("cache-control")).toBe("no-store");
  }

  it("allows a valid handle for a granted Module and says who and where", async () => {
    const handle = await signInTo("CRMS");
    const response = await validate(handle);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: true,
      user_id: "user-1",
      system: "CRMS",
      module: "Dashboard",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps working request after request while nothing has changed", async () => {
    const handle = await signInTo("CRMS");

    for (let index = 0; index < 3; index += 1) {
      expect((await validate(handle)).status).toBe(200);
    }
  });

  describe("next request is denied after central logout", () => {
    it("for the same handle, even though cached session data and signed tokens still look fine", async () => {
      const handle = await signInTo("CRMS");
      expect((await validate(handle)).status).toBe(200);

      ctx.world.liveSessions.delete("neon-session-1");
      expect(ctx.world.staleCachedSession).toEqual({ valid: true });

      await expectDenied(await validate(handle), 401, "invalid_handle");
    });

    it("for every related handle across all four Systems", async () => {
      const handles = new Map<(typeof SYSTEM_NAMES)[number], string>();

      for (const name of SYSTEM_NAMES) {
        handles.set(name, await signInTo(name));
        expect((await validate(handles.get(name)!, "Dashboard", name)).status).toBe(200);
      }

      ctx.world.liveSessions.delete("neon-session-1");

      for (const name of SYSTEM_NAMES) {
        await expectDenied(await validate(handles.get(name)!, "Dashboard", name), 401, "invalid_handle");
      }
    });

    it("by explicit revocation of the handle, even if the central session were somehow live", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.sessions[0].revokedAt = ctx.world.now;

      await expectDenied(await validate(handle), 401, "invalid_handle");
    });

    it("but not for a handle bound to a different browser session", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.liveSessions.add("neon-session-2");
      ctx.world.sessions[0] = { ...ctx.world.sessions[0], neonSessionId: "neon-session-2" };
      ctx.world.liveSessions.delete("neon-session-1");

      expect((await validate(handle)).status).toBe(200);
    });
  });

  describe("Module access is read live", () => {
    it("denies a revoked Module on the next request without logout, leaving another Module usable", async () => {
      const handle = await signInTo("CRMS");
      expect((await validate(handle, "Dashboard")).status).toBe(200);
      expect((await validate(handle, "Customer Profiles")).status).toBe(200);

      ctx.world.grants.delete("user-1:sys-CRMS:Customer Profiles");

      await expectDenied(await validate(handle, "Customer Profiles"), 403, "access_denied");
      expect((await validate(handle, "Dashboard")).status).toBe(200);
      expect(ctx.world.liveSessions.has("neon-session-1")).toBe(true);
    });

    it("denies a Module the User never had", async () => {
      const handle = await signInTo("CRMS");

      await expectDenied(await validate(handle, "Payroll & ESS"), 403, "access_denied");
    });

    it("denies a Module that belongs to a different System", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.grants.add("user-1:sys-POS:Cashiering");

      await expectDenied(await validate(handle, "Cashiering"), 403, "access_denied");
    });

    it("picks up a newly granted Module immediately", async () => {
      const handle = await signInTo("CRMS");
      await expectDenied(await validate(handle, "Reports"), 403, "access_denied");

      ctx.world.grants.add("user-1:sys-CRMS:Reports");

      expect((await validate(handle, "Reports")).status).toBe(200);
    });
  });

  describe("User eligibility is read live", () => {
    it("denies a Deleted or missing User, and again allows them once Restored", async () => {
      const handle = await signInTo("CRMS");

      ctx.world.eligible.delete("user-1");
      await expectDenied(await validate(handle), 403, "access_denied");

      ctx.world.eligible.add("user-1");
      expect((await validate(handle)).status).toBe(200);
    });

    it("denies a User put back into a mandatory password change", async () => {
      const handle = await signInTo("CRMS");

      // Resend credentials flips mustChangePassword; the eligibility port covers it.
      ctx.world.eligible.delete("user-1");

      await expectDenied(await validate(handle), 403, "access_denied");
    });

    it("still answers access_denied when the audit write itself fails", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.grants.delete("user-1:sys-CRMS:Dashboard");
      ctx.deps.audit = async () => {
        throw new Error("audit down");
      };

      await expectDenied(await validate(handle), 403, "access_denied");
    });

    it("records a denial against the identified User without leaking the handle or secret", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.audit.length = 0;
      ctx.world.grants.delete("user-1:sys-CRMS:Dashboard");

      await validate(handle);

      expect(ctx.world.audit).toEqual([
        expect.objectContaining({
          action: "integration.validate",
          outcome: "FAILURE",
          targetUserId: "user-1",
        }),
      ]);
      expect(JSON.stringify(ctx.world.audit)).not.toContain(handle);
      expect(JSON.stringify(ctx.world.audit)).not.toContain(ctx.secrets.CRMS);
    });
  });

  describe("handles are refused", () => {
    it("when unknown or malformed", async () => {
      await expectDenied(await validate("ish_not-a-real-handle"), 401, "invalid_handle");
      await expectDenied(await validate("garbage"), 401, "invalid_handle");
    });

    it("when expired", async () => {
      const handle = await signInTo("CRMS");
      ctx.world.now = new Date(ctx.world.sessions[0].expiresAt.getTime() + 1);

      await expectDenied(await validate(handle), 401, "invalid_handle");
    });

    it("from a different System, indistinguishably from an unknown handle", async () => {
      const handle = await signInTo("CRMS");

      await expectDenied(await validate(handle, "Dashboard", "POS"), 401, "invalid_handle");
    });
  });

  describe("requests are refused", () => {
    it("with bad or missing backend credentials, without touching the handle", async () => {
      const handle = await signInTo("CRMS");

      await expectDenied(await validate(handle, "Dashboard", "CRMS", "iss_wrong"), 401, "invalid_client");
      await expectDenied(await validate(handle, "Dashboard", "CRMS", ctx.secrets.POS), 401, "invalid_client");

      const anonymous = await handleValidate(
        new Request("https://portal.example.com/api/integrations/validate", {
          method: "POST",
          body: JSON.stringify({ handle, module: "Dashboard" }),
        }),
        ctx.deps,
      );
      await expectDenied(anonymous, 401, "invalid_client");
      expect(anonymous.headers.get("www-authenticate")).toContain("Basic");
    });

    it("without a handle or a Module, or with an unreadable body", async () => {
      const handle = await signInTo("CRMS");

      await expectDenied(await validate(handle, null), 400, "invalid_request");
      await expectDenied(await validate("", "Dashboard"), 400, "invalid_request");

      const unreadable = await handleValidate(
        new Request("https://portal.example.com/api/integrations/validate", {
          method: "POST",
          headers: { Authorization: basic("CRMS", ctx.secrets.CRMS) },
          body: "not json",
        }),
        ctx.deps,
      );
      await expectDenied(unreadable, 400, "invalid_request");
    });
  });

  describe("an outage never yields a positive decision", () => {
    it("answers temporarily_unavailable when the provider or database cannot be reached", async () => {
      const handle = await signInTo("CRMS");
      expect((await validate(handle)).status).toBe(200);

      ctx.world.outage = true;
      const response = await validate(handle);

      await expectDenied(response, 503, "temporarily_unavailable");
      expect(response.headers.get("retry-after")).toBe("5");
    });

    it("for each dependency separately, so no single failure lets a request through", async () => {
      const handle = await signInTo("CRMS");

      for (const port of [
        "findIntegrationSession",
        "isCentralSessionActive",
        "isUserEligible",
        "hasActiveGrantInModule",
      ] as const) {
        const original = ctx.ports[port];
        (ctx.ports as Record<string, unknown>)[port] = async () => {
          throw new Error(`${port} down`);
        };

        await expectDenied(await validate(handle), 503, "temporarily_unavailable");

        (ctx.ports as Record<string, unknown>)[port] = original;
      }

      expect((await validate(handle)).status).toBe(200);
    });

    it("recovers by itself once the outage ends, with no stale decision remembered", async () => {
      const handle = await signInTo("CRMS");

      ctx.world.outage = true;
      expect((await validate(handle)).status).toBe(503);
      ctx.world.outage = false;

      expect((await validate(handle)).status).toBe(200);
    });
  });
});
