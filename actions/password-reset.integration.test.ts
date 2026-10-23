import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const neon = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  auth: { requestPasswordReset: neon.request, resetPassword: neon.reset },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

// The agreed seam is the Server Actions, with real Postgres and Neon Auth faked
// at its external boundary. Never use the production URL for this suite.
const databaseUrl = process.env.SEED_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("password recovery through Server Actions on disposable Neon", () => {
  let prisma: (typeof import("@/lib/db/prisma"))["prisma"];
  let actions: typeof import("./auth");
  let signedLink: typeof import("@/lib/auth/reset-link");
  const suffix = randomUUID();
  const email = `reset-${suffix}@example.test`;
  const otherEmail = `other-${suffix}@example.test`;
  const userId = `reset-${suffix}`;
  const roleId = `reset-role-${suffix}`;
  const neonId = randomUUID();
  let token: string;

  const formFor = (fields: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
  };
  const resetForm = (fields: Record<string, string> = {}) => formFor({
    token, password: "new-password", confirmation: "new-password", ...fields,
  });
  const status = async () => (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).mustChangePassword;
  const invalid = { error: "This reset link is invalid or has expired. Request a new one." };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.NEON_AUTH_COOKIE_SECRET = "test-reset-secret-at-least-thirty-two-characters";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    // Keep audit/notification network side effects disabled for this suite.
    delete process.env.API_GATEWAY_URL;
    ({ prisma } = await import("@/lib/db/prisma"));
    actions = await import("./auth");
    signedLink = await import("@/lib/auth/reset-link");
    await prisma.role.create({ data: { id: roleId, name: roleId } });
    await prisma.user.create({ data: {
      id: userId, username: `2099-RESET-${suffix}`, email, firstName: "Reset",
      lastName: "Test", roleId, neonAuthUserId: neonId, mustChangePassword: true,
    } });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    token = randomUUID();
    await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true, isDeleted: false } });
    await prisma.$executeRaw`
      INSERT INTO neon_auth.verification (id, identifier, value, "createdAt", "updatedAt", "expiresAt")
      VALUES (${randomUUID()}::uuid, ${`reset-password:${token}`}, ${neonId}, now(), now(), now() + interval '1 hour')
    `;
    neon.request.mockResolvedValue({ error: null });
    // Model the external provider's single-use contract, including consumption.
    neon.reset.mockImplementation(async ({ token: usedToken }: { token: string }) => {
      const consumed = await prisma.$executeRaw`DELETE FROM neon_auth.verification WHERE identifier = ${`reset-password:${usedToken}`}`;
      return { error: consumed ? null : { message: "invalid" } };
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRaw`DELETE FROM neon_auth.verification WHERE value = ${neonId}`;
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.$disconnect();
  });

  it("returns identical confirmations for registered, unknown and Deleted Emails", async () => {
    const known = await actions.forgotPasswordAction({ error: null }, formFor({ email }));
    const unknown = await actions.forgotPasswordAction({ error: null }, formFor({ email: otherEmail }));
    await prisma.user.update({ where: { id: userId }, data: { isDeleted: true } });
    const deleted = await actions.forgotPasswordAction({ error: null }, formFor({ email }));
    expect(known).toEqual(unknown);
    expect(deleted).toEqual(known);
    expect(neon.request).toHaveBeenCalledOnce();
  });

  it("caps provider-created reset tokens at exactly 15 minutes", async () => {
    const [row] = await prisma.$queryRaw<{ seconds: number }[]>`
      SELECT extract(epoch FROM ("expiresAt" - "createdAt"))::int AS seconds
      FROM neon_auth.verification WHERE identifier = ${`reset-password:${token}`}
    `;
    expect(row.seconds).toBe(900);
  });

  it("leaves other Neon verification lifetimes unchanged", async () => {
    const identifier = `email-verification:${randomUUID()}`;
    await prisma.$executeRaw`
      INSERT INTO neon_auth.verification (id, identifier, value, "createdAt", "updatedAt", "expiresAt")
      VALUES (${randomUUID()}::uuid, ${identifier}, ${neonId}, now(), now(), now() + interval '1 hour')
    `;
    const [row] = await prisma.$queryRaw<{ seconds: number }[]>`
      SELECT extract(epoch FROM ("expiresAt" - "createdAt"))::int AS seconds
      FROM neon_auth.verification WHERE identifier = ${identifier}
    `;
    expect(row.seconds).toBe(3600);
  });

  it("activates an Awaiting-first-login User and sends them to login after a signed reset", async () => {
    const fields = signedLink.resetLinkParams(email);
    await expect(actions.resetPasswordAction({ error: null }, resetForm(fields))).rejects.toThrow("redirect:/login?reset=1");
    expect(await status()).toBe(false);
    expect(neon.reset).toHaveBeenCalledWith({ token, newPassword: "new-password" });
    await expect(actions.resetPasswordAction({ error: null }, resetForm(fields))).resolves.toEqual(invalid);
  });

  it.each(["missing", "tampered", "another User"])("resets without activation for a %s signature", async (kind) => {
    const fields = kind === "missing" ? {} : kind === "tampered"
      ? { e: email, s: "tampered" } : signedLink.resetLinkParams(otherEmail);
    await expect(actions.resetPasswordAction({ error: null }, resetForm(fields))).rejects.toThrow("redirect:/login?reset=1");
    expect(await status()).toBe(true);
    expect(neon.reset).toHaveBeenCalledOnce();
  });

  it("rejects a token at the 15-minute boundary before the provider changes the password", async () => {
    await prisma.$executeRaw`
      UPDATE neon_auth.verification SET "createdAt" = now() - interval '15 minutes', "expiresAt" = now()
      WHERE identifier = ${`reset-password:${token}`}
    `;
    await expect(actions.resetPasswordAction({ error: null }, resetForm())).resolves.toEqual(invalid);
    expect(neon.reset).not.toHaveBeenCalled();
    expect(await status()).toBe(true);
  });

  it("rejects an outstanding link when the User has since become Deleted", async () => {
    await prisma.user.update({ where: { id: userId }, data: { isDeleted: true } });
    await expect(actions.resetPasswordAction({ error: null }, resetForm(signedLink.resetLinkParams(email)))).resolves.toEqual(invalid);
    expect(neon.reset).not.toHaveBeenCalled();
    expect(await status()).toBe(true);
  });

  it.each([
    ["too short", { password: "short", confirmation: "short" }, "Use at least 8 characters."],
    ["mismatch", { confirmation: "different-password" }, "The new passwords don't match."],
  ])("rejects a %s password without consuming the link", async (_kind, fields, error) => {
    await expect(actions.resetPasswordAction({ error: null }, resetForm(fields))).resolves.toEqual({ error });
    expect(neon.reset).not.toHaveBeenCalled();
    expect(await status()).toBe(true);
  });

  it("rejects a missing token", async () => {
    const form = resetForm(); form.delete("token");
    await expect(actions.resetPasswordAction({ error: null }, form)).resolves.toEqual(invalid);
    expect(neon.reset).not.toHaveBeenCalled();
  });
});
