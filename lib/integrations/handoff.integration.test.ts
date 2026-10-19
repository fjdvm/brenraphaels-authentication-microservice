import { createHash, randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashSecret } from "./secrets";

// Real persistence in an isolated Postgres (HANDOFF_TEST_DATABASE_URL, migrations applied).
// Neon Auth is faked at the provider edge: only its session lookup.
const databaseUrl = process.env.HANDOFF_TEST_DATABASE_URL;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: undefined as unknown as import("@prisma/client").PrismaClient,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocks.getSession } }));
vi.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return mocks.prisma;
  },
}));

const ORIGIN = "https://portal.test";
const CRMS_CALLBACK = "https://epic-crms.vercel.app/api/portal/callback";
const LOCAL_CALLBACK = "http://localhost:3000/api/portal/callback";
const SECRET = "crms-backend-secret";

describe.skipIf(!databaseUrl)("the sign-in handoff", () => {
  const prisma = databaseUrl
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
    : (undefined as unknown as PrismaClient);
  mocks.prisma = prisma;

  let ids: { crms: string; pos: string; role: string; customerProfiles: string };

  afterAll(() => prisma.$disconnect());

  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    mocks.getSession.mockReset();

    await prisma.$executeRawUnsafe(
      'TRUNCATE "HandoffCode", "SystemSession", "AccessGrant", "SystemCallback", "Module", "User", "Role", "System" CASCADE',
    );

    const role = await prisma.role.create({ data: { name: "CRMS Manager" } });
    const crms = await prisma.system.create({
      data: {
        name: "CRMS",
        url: "https://epic-crms.vercel.app",
        secretHash: hashSecret(SECRET),
        callbacks: {
          create: [
            { url: CRMS_CALLBACK, nonProductionOnly: false },
            { url: LOCAL_CALLBACK, nonProductionOnly: true },
          ],
        },
      },
    });
    const pos = await prisma.system.create({
      data: { name: "POS", url: "https://placeholder.test", secretHash: hashSecret("pos") },
    });
    const customerProfiles = await prisma.module.create({
      data: { systemId: crms.id, name: "Customer Profiles" },
    });
    ids = { crms: crms.id, pos: pos.id, role: role.id, customerProfiles: customerProfiles.id };
  });

  async function createUser(
    name: string,
    overrides: { isDeleted?: boolean; mustChangePassword?: boolean; withModule?: boolean } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        username: `2026-${name}-001`,
        email: `${name}@example.com`,
        firstName: name,
        lastName: "Staff",
        roleId: ids.role,
        neonAuthUserId: `neon-${name}`,
        mustChangePassword: overrides.mustChangePassword ?? false,
        isDeleted: overrides.isDeleted ?? false,
      },
    });
    if (overrides.withModule ?? true) {
      await prisma.accessGrant.create({
        data: { userId: user.id, moduleId: ids.customerProfiles },
      });
    }
    return user;
  }

  function signedInAs(name: string | null, sessionId = "session-1") {
    mocks.getSession.mockResolvedValue({
      data: name ? { user: { id: `neon-${name}` }, session: { id: sessionId } } : null,
    });
  }

  function pkce() {
    const verifier = randomBytes(32).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
  }

  async function authorize(
    params: Partial<Record<string, string>> & { challenge?: string } = {},
  ) {
    const { GET } = await import("@/app/api/integrations/authorize/route");
    const query = new URLSearchParams({
      system: "CRMS",
      redirect_uri: CRMS_CALLBACK,
      state: "correlation-1",
      code_challenge: params.challenge ?? "challenge",
      code_challenge_method: "S256",
    });
    for (const [key, value] of Object.entries(params)) {
      if (key !== "challenge" && value !== undefined) query.set(key, value);
    }
    return GET(new Request(`${ORIGIN}/api/integrations/authorize?${query}`));
  }

  async function exchange(
    body: Record<string, string>,
    credentials: { system: string; secret: string } | null = { system: "CRMS", secret: SECRET },
  ) {
    const { POST } = await import("@/app/api/integrations/token/route");
    return POST(
      new Request(`${ORIGIN}/api/integrations/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(credentials
            ? {
                authorization: `Basic ${Buffer.from(`${credentials.system}:${credentials.secret}`).toString("base64")}`,
              }
            : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  }

  /** Authorize as a Staff member and return the callback's code with its PKCE verifier. */
  async function issuedCode(name = "ada") {
    await createUser(name);
    signedInAs(name);
    const { verifier, challenge } = pkce();
    const response = await authorize({ challenge });
    const callback = new URL(response.headers.get("location")!);
    return { code: callback.searchParams.get("code")!, verifier };
  }

  const exchangeBody = (code: string, verifier: string, overrides: Record<string, string> = {}) => ({
    code,
    redirect_uri: CRMS_CALLBACK,
    state: "correlation-1",
    code_verifier: verifier,
    ...overrides,
  });

  describe("authorizing", () => {
    it("returns a Staff member with a CRMS Module to the registered callback with a code and their correlation", async () => {
      await createUser("ada");
      signedInAs("ada");

      const response = await authorize();
      const location = new URL(response.headers.get("location")!);

      expect(response.status).toBe(302);
      expect(`${location.origin}${location.pathname}`).toBe(CRMS_CALLBACK);
      expect(location.searchParams.get("code")).toBeTruthy();
      expect(location.searchParams.get("state")).toBe("correlation-1");
    });

    it("reads the session fresh rather than from the SDK's cookie cache", async () => {
      await createUser("ada");
      signedInAs("ada");

      await authorize();

      expect(mocks.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: "true" } });
    });

    it("refuses a Staff member with no CRMS Module, even if they hold a Module in another System", async () => {
      const user = await createUser("ada", { withModule: false });
      const posModule = await prisma.module.create({ data: { systemId: ids.pos, name: "Sales" } });
      await prisma.accessGrant.create({ data: { userId: user.id, moduleId: posModule.id } });
      signedInAs("ada");

      const response = await authorize();
      const location = new URL(response.headers.get("location")!);

      expect(location.searchParams.get("error")).toBe("access_denied");
      expect(location.searchParams.get("state")).toBe("correlation-1");
      expect(location.searchParams.has("code")).toBe(false);
    });

    it("refuses a Staff member whose only CRMS grant was revoked", async () => {
      const user = await createUser("ada");
      await prisma.accessGrant.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      });
      signedInAs("ada");

      const location = new URL((await authorize()).headers.get("location")!);

      expect(location.searchParams.get("error")).toBe("access_denied");
    });

    it("refuses a Deleted Staff member", async () => {
      await createUser("ada", { isDeleted: true });
      signedInAs("ada");

      const location = new URL((await authorize()).headers.get("location")!);

      expect(location.searchParams.get("error")).toBe("access_denied");
      expect(location.searchParams.has("code")).toBe(false);
    });

    it("sends a Staff member awaiting first login to change their password, then back to the request", async () => {
      await createUser("ada", { mustChangePassword: true });
      signedInAs("ada");

      const response = await authorize();
      const location = new URL(response.headers.get("location")!);
      const returnTo = location.searchParams.get("returnTo")!;

      expect(location.pathname).toBe("/change-password");
      expect(returnTo.startsWith("/api/integrations/authorize?")).toBe(true);
      expect(new URL(returnTo, ORIGIN).searchParams.get("state")).toBe("correlation-1");
      expect(await prisma.handoffCode.count()).toBe(0);
    });

    it("sends a visitor with no session to the Portal login, returning to the authorized request", async () => {
      signedInAs(null);

      const response = await authorize();
      const location = new URL(response.headers.get("location")!);

      expect(location.pathname).toBe("/login");
      expect(new URL(location.searchParams.get("returnTo")!, ORIGIN).searchParams.get("redirect_uri")).toBe(
        CRMS_CALLBACK,
      );
      expect(await prisma.handoffCode.count()).toBe(0);
    });

    it("rejects unregistered callbacks and arbitrary return addresses without redirecting", async () => {
      await createUser("ada");
      signedInAs("ada");

      for (const redirect_uri of [
        "https://evil.example/api/portal/callback",
        "https://epic-crms.vercel.app/other",
        `${CRMS_CALLBACK}/`,
        `${CRMS_CALLBACK}?next=https://evil.example`,
        "https://epic-crms.vercel.app.evil.example/api/portal/callback",
      ]) {
        const response = await authorize({ redirect_uri });
        expect(response.status).toBe(400);
        expect(response.headers.get("location")).toBeNull();
      }
    });

    it("does not trust a System that has no registered callbacks", async () => {
      const response = await authorize({ system: "POS", redirect_uri: "https://placeholder.test/cb" });

      expect(response.status).toBe(400);
    });

    it("rejects a callback registered to a different System", async () => {
      const response = await authorize({ system: "POS", redirect_uri: CRMS_CALLBACK });

      expect(response.status).toBe(400);
    });

    it("requires a state and an S256 code challenge", async () => {
      await createUser("ada");
      signedInAs("ada");

      expect((await authorize({ state: "" })).status).toBe(400);
      expect((await authorize({ code_challenge_method: "plain" })).status).toBe(400);
    });

    it("accepts the localhost callback outside production only", async () => {
      await createUser("ada");
      signedInAs("ada");

      const development = await authorize({ redirect_uri: LOCAL_CALLBACK });
      expect(new URL(development.headers.get("location")!).searchParams.get("code")).toBeTruthy();

      vi.stubEnv("NODE_ENV", "production");
      const production = await authorize({ redirect_uri: LOCAL_CALLBACK });
      expect(production.status).toBe(400);
    });
  });

  describe("exchanging a code", () => {
    it("gives the registered System's backend an opaque handle bound to that System and the central session", async () => {
      await createUser("ada");
      signedInAs("ada", "central-session-9");
      const { verifier, challenge } = pkce();
      const callback = new URL((await authorize({ challenge })).headers.get("location")!);

      const response = await exchange(
        exchangeBody(callback.searchParams.get("code")!, verifier),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.session_handle).toEqual(expect.any(String));
      const stored = await prisma.systemSession.findUniqueOrThrow({
        where: { handleHash: hashSecret(body.session_handle) },
      });
      expect(stored).toMatchObject({ systemId: ids.crms, centralSessionId: "central-session-9" });
    });

    it("stores codes and handles only as hashes", async () => {
      const { code, verifier } = await issuedCode();
      const body = await (await exchange(exchangeBody(code, verifier))).json();

      const rows = JSON.stringify([
        await prisma.handoffCode.findMany(),
        await prisma.systemSession.findMany(),
        await prisma.system.findMany(),
      ]);
      expect(rows).not.toContain(code);
      expect(rows).not.toContain(body.session_handle);
      expect(rows).not.toContain(SECRET);
    });

    it("rejects a replayed code", async () => {
      const { code, verifier } = await issuedCode();

      expect((await exchange(exchangeBody(code, verifier))).status).toBe(200);
      const replay = await exchange(exchangeBody(code, verifier));

      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual({ error: "invalid_grant" });
      expect(await prisma.systemSession.count()).toBe(1);
    });

    it("lets exactly one of many concurrent exchanges succeed", async () => {
      const { code, verifier } = await issuedCode();

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => exchange(exchangeBody(code, verifier))),
      );

      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(await prisma.systemSession.count()).toBe(1);
    });

    it("rejects an expired code", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { code, verifier } = await issuedCode();

      vi.setSystemTime(Date.now() + 61_000);
      const response = await exchange(exchangeBody(code, verifier));

      expect(response.status).toBe(400);
      expect(await prisma.systemSession.count()).toBe(0);
    });

    it("rejects tampered correlation and a different callback", async () => {
      const attempts: Record<string, string>[] = [
        { state: "correlation-2" },
        { redirect_uri: LOCAL_CALLBACK },
      ];
      for (const overrides of attempts) {
        const { code, verifier } = await issuedCode(`u${Math.random().toString(36).slice(2, 6)}`);
        const response = await exchange(exchangeBody(code, verifier, overrides));
        expect(response.status).toBe(400);
      }
      expect(await prisma.systemSession.count()).toBe(0);
    });

    it("rejects the wrong proof of possession, and the code is then spent", async () => {
      const { code, verifier } = await issuedCode();

      const wrong = await exchange(exchangeBody(code, pkce().verifier));
      const correctAfterwards = await exchange(exchangeBody(code, verifier));

      expect(wrong.status).toBe(400);
      expect(correctAfterwards.status).toBe(400);
      expect(await prisma.systemSession.count()).toBe(0);
    });

    it("rejects another System's backend, without spending the code", async () => {
      const { code, verifier } = await issuedCode();

      const other = await exchange(exchangeBody(code, verifier), { system: "POS", secret: "pos" });
      const owner = await exchange(exchangeBody(code, verifier));

      expect(other.status).toBe(400);
      expect(owner.status).toBe(200);
    });

    it("rejects missing, wrong and unregistered System credentials", async () => {
      const { code, verifier } = await issuedCode();
      const body = exchangeBody(code, verifier);

      for (const credentials of [
        null,
        { system: "CRMS", secret: "wrong" },
        { system: "CRMS", secret: "" },
        { system: "NOPE", secret: SECRET },
        { system: "POS", secret: SECRET },
      ]) {
        const response = await exchange(body, credentials);
        expect(response.status).toBe(401);
      }
      expect(await prisma.systemSession.count()).toBe(0);
    });

    it("rejects a System that has no backend secret configured", async () => {
      await prisma.system.update({ where: { id: ids.crms }, data: { secretHash: null } });

      expect((await exchange({}, { system: "CRMS", secret: "" })).status).toBe(401);
    });

    it("rejects the exchange if the Staff member lost access or was deleted after authorizing", async () => {
      const { code, verifier } = await issuedCode();
      await prisma.accessGrant.updateMany({ data: { revokedAt: new Date() } });

      expect((await exchange(exchangeBody(code, verifier))).status).toBe(400);
      expect(await prisma.systemSession.count()).toBe(0);
    });

    it("rejects incomplete requests", async () => {
      const response = await exchange({ code: "x" });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    });
  });

  it("never writes codes, handles or secrets to the logs", async () => {
    const logged: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args) => {
        logged.push(args.map(String).join(" "));
      }),
    );

    const { code, verifier } = await issuedCode();
    const body = await (await exchange(exchangeBody(code, verifier))).json();
    await exchange(exchangeBody(code, verifier), { system: "CRMS", secret: "wrong" });
    await exchange(exchangeBody(code, verifier));

    spies.forEach((spy) => spy.mockRestore());
    const output = logged.join("\n");
    for (const sensitive of [code, verifier, body.session_handle, SECRET]) {
      expect(output).not.toContain(sensitive);
    }
  });
});
