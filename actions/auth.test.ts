import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  signInEmail: vi.fn(),
  changePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
  record: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    signIn: { email: mocks.signInEmail },
    signOut: mocks.signOut,
    changePassword: mocks.changePassword,
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requirePasswordChangeUser: vi.fn(),
  getPortalUser: vi.fn(),
}));

vi.mock("@/lib/audit/system-log", () => ({ recordSystemLogEvent: mocks.record }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  logoutAction,
  resetPasswordAction,
} from "./auth";
import { getPortalUser, requirePasswordChangeUser } from "@/lib/auth/session";
import { resetLinkParams } from "@/lib/auth/reset-link";
import {
  RETURN_INTENT_TTL_MS,
  checkReturnIntent,
  issueReturnIntent,
} from "@/lib/integrations/return-intent";

const validForm = (username = "2026-admin-001", password = "password") => {
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  return form;
};

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "admin-id",
      email: "admin@example.com",
      isDeleted: false,
      mustChangePassword: false,
    });
    mocks.signInEmail.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("matches Username without regard to case and signs in using the linked Email", async () => {
    await expect(loginAction({ error: null }, validForm())).rejects.toThrow(
      "redirect:/",
    );

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username: "2026-ADMIN-001" },
      select: { id: true, email: true, isDeleted: true, mustChangePassword: true },
    });
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "password",
    });
  });

  it.each([
    ["unknown Username", null, { error: null }],
    ["Deleted User", { id: "d", email: "deleted@example.com", isDeleted: true, mustChangePassword: false }, { error: null }],
    ["wrong password", { id: "w", email: "admin@example.com", isDeleted: false, mustChangePassword: false }, { error: { message: "invalid" } }],
  ])("returns the same error for a %s", async (_case, user, signInResult) => {
    mocks.findUnique.mockResolvedValue(user);
    mocks.signInEmail.mockResolvedValue(signInResult);

    await expect(loginAction({ error: null }, validForm())).resolves.toEqual({
      error: "Invalid credentials",
    });
  });

  it("records a successful login with the signed-in User as actor", async () => {
    await expect(loginAction({ error: null }, validForm())).rejects.toThrow();

    expect(mocks.record).toHaveBeenCalledWith({
      action: "auth.login",
      outcome: "SUCCESS",
      actorId: "admin-id",
      targetUserId: "admin-id",
    });
  });

  it("records a failed login without claiming an actor, and without the password", async () => {
    mocks.signInEmail.mockResolvedValue({ error: { message: "invalid" } });

    await loginAction({ error: null }, validForm("2026-admin-001", "s3cret-pw"));

    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        outcome: "FAILURE",
        targetUserId: "admin-id",
      }),
    );
    const event = mocks.record.mock.calls[0][0];
    expect(event.actorId).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("s3cret-pw");
  });

  it("records a failed login for an unknown Username with no target", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await loginAction({ error: null }, validForm());

    const event = mocks.record.mock.calls[0][0];
    expect(event).toMatchObject({ action: "auth.login", outcome: "FAILURE" });
    expect(event.actorId).toBeUndefined();
    expect(event.targetUserId).toBeUndefined();
  });

  it("sends a User awaiting first login to change their password", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "new-id",
      email: "new.user@example.com",
      isDeleted: false,
      mustChangePassword: true,
    });

    await expect(loginAction({ error: null }, validForm())).rejects.toThrow(
      "redirect:/change-password",
    );
  });

  it("ends the Neon Auth session and returns the User to login", async () => {
    await expect(logoutAction()).rejects.toThrow("redirect:/login");

    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("records the logout outcome against the signed-in User", async () => {
    vi.mocked(getPortalUser).mockResolvedValue({ id: "admin-id" } as never);

    await expect(logoutAction()).rejects.toThrow("redirect:/login");
    expect(mocks.record).toHaveBeenCalledWith({
      action: "auth.logout",
      outcome: "SUCCESS",
      actorId: "admin-id",
      targetUserId: "admin-id",
    });

    mocks.signOut.mockResolvedValue({ error: { message: "boom" } });
    await expect(logoutAction()).rejects.toThrow("redirect:/login");
    expect(mocks.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "auth.logout", outcome: "FAILURE" }),
    );
  });
});

describe("changePasswordAction", () => {
  const validPasswordChange = (overrides: Record<string, string> = {}) => {
    const form = new FormData();
    form.set("currentPassword", "temporary-password");
    form.set("password", "new-password");
    form.set("confirmation", "new-password");
    for (const [name, value] of Object.entries(overrides)) form.set(name, value);
    return form;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePasswordChangeUser).mockResolvedValue({
      id: "portal-user",
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "admin@example.com",
      mustChangePassword: true,
      isAdministrator: true,
    });
    mocks.changePassword.mockResolvedValue({ error: null });
    mocks.update.mockResolvedValue({});
  });

  it.each([
    ["a password under eight characters", { password: "short", confirmation: "short" }, "Use at least 8 characters."],
    ["mismatched passwords", { confirmation: "different-password" }, "The new passwords don't match."],
    ["the current password reused", { password: "temporary-password", confirmation: "temporary-password" }, "Choose a password different from your current one."],
  ])("rejects %s", async (_case, fields, error) => {
    await expect(
      changePasswordAction({ error: null }, validPasswordChange(fields)),
    ).resolves.toEqual({ error });

    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect temporary password", async () => {
    mocks.changePassword.mockResolvedValue({ error: { message: "invalid" } });

    await expect(
      changePasswordAction({ error: null }, validPasswordChange()),
    ).resolves.toEqual({ error: "Your current password is incorrect." });
  });

  it("records password-change success and failure without passwords", async () => {
    mocks.changePassword.mockResolvedValue({ error: { message: "invalid" } });
    await changePasswordAction({ error: null }, validPasswordChange());
    expect(mocks.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "auth.password_change",
        outcome: "FAILURE",
        actorId: "portal-user",
      }),
    );

    mocks.changePassword.mockResolvedValue({ error: null });
    await expect(
      changePasswordAction({ error: null }, validPasswordChange()),
    ).rejects.toThrow("redirect:/");
    expect(mocks.record).toHaveBeenLastCalledWith({
      action: "auth.password_change",
      outcome: "SUCCESS",
      actorId: "portal-user",
      targetUserId: "portal-user",
    });
    expect(JSON.stringify(mocks.record.mock.calls)).not.toMatch(/temporary-password|new-password/);
  });

  it("does not record password-change success when the status update fails", async () => {
    mocks.update.mockRejectedValue(new Error("db down"));

    await expect(
      changePasswordAction({ error: null }, validPasswordChange()),
    ).rejects.toThrow("db down");

    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("marks the User Active, revokes other sessions, and opens the portal", async () => {
    await expect(
      changePasswordAction({ error: null }, validPasswordChange()),
    ).rejects.toThrow("redirect:/");

    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "temporary-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "portal-user" },
      data: { mustChangePassword: false },
    });
  });
});

describe("forgotPasswordAction", () => {
  const formFor = (email: string) => {
    const form = new FormData();
    form.set("email", email);
    return form;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://portal.example.test";
    process.env.NEON_AUTH_COOKIE_SECRET = "a-test-secret-that-is-at-least-thirty-two-characters";
    mocks.requestPasswordReset.mockResolvedValue({ error: null });
  });

  it("requests a reset only for an active User and signs the return Email", async () => {
    mocks.findUnique.mockResolvedValue({ id: "person-id", isDeleted: false });

    await expect(
      forgotPasswordAction({ error: null }, formFor("PERSON@EXAMPLE.TEST")),
    ).resolves.toEqual({
      error: null,
      message:
        "If a User exists for that Email, a reset link is on its way. It expires in 15 minutes.",
    });

    const expected = resetLinkParams("person@example.test");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "person@example.test" },
      select: { id: true, isDeleted: true },
    });
    expect(mocks.record).toHaveBeenCalledWith({
      action: "auth.password_reset_request",
      outcome: "SUCCESS",
      targetUserId: "person-id",
    });
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: "person@example.test",
      redirectTo: `https://portal.example.test/reset-password?e=person%40example.test&s=${expected.s}`,
    });
  });

  it.each([null, { isDeleted: true }])(
    "returns the same confirmation without requesting a link for an unknown or Deleted Email",
    async (user) => {
      mocks.findUnique.mockResolvedValue(user);

      await expect(
        forgotPasswordAction({ error: null }, formFor("person@example.test")),
      ).resolves.toEqual({
        error: null,
        message:
          "If a User exists for that Email, a reset link is on its way. It expires in 15 minutes.",
      });

      expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
      expect(mocks.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.password_reset_request", outcome: "FAILURE" }),
      );
    },
  );
});

describe("resetPasswordAction", () => {
  const validReset = (overrides: Record<string, string> = {}) => {
    const form = new FormData();
    form.set("token", "valid-reset-token");
    form.set("password", "new-password");
    form.set("confirmation", "new-password");
    for (const [name, value] of Object.entries(overrides)) form.set(name, value);
    return form;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEON_AUTH_COOKIE_SECRET = "a-test-secret-that-is-at-least-thirty-two-characters";
    mocks.resetPassword.mockResolvedValue({ error: null });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUnique.mockResolvedValue({ id: "person-id" });
  });

  it("shows a clear error when Neon Auth rejects an expired or invalid token", async () => {
    mocks.resetPassword.mockResolvedValue({ error: { message: "expired" } });

    await expect(
      resetPasswordAction({ error: null }, validReset()),
    ).resolves.toEqual({
      error: "This reset link is invalid or has expired. Request a new one.",
    });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("shows the same clear error for a missing token", async () => {
    const form = validReset();
    form.delete("token");

    await expect(resetPasswordAction({ error: null }, form)).resolves.toEqual({
      error: "This reset link is invalid or has expired. Request a new one.",
    });

    expect(mocks.resetPassword).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("sets a new password, activates the signed User, and returns to login", async () => {
    const email = "person@example.test";
    const { e, s } = resetLinkParams(email);

    await expect(
      resetPasswordAction({ error: null }, validReset({ e, s })),
    ).rejects.toThrow("redirect:/login?reset=1");

    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "new-password",
      token: "valid-reset-token",
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { email },
      data: { mustChangePassword: false },
    });
    expect(mocks.record).toHaveBeenCalledWith({
      action: "auth.password_reset",
      outcome: "SUCCESS",
      actorId: "person-id",
      targetUserId: "person-id",
    });
    expect(JSON.stringify(mocks.record.mock.calls)).not.toMatch(/valid-reset-token|new-password/);
  });

  it("records a failed reset against the signed User without an actor", async () => {
    mocks.resetPassword.mockResolvedValue({ error: { message: "expired" } });
    const { e, s } = resetLinkParams("person@example.test");

    await resetPasswordAction({ error: null }, validReset({ e, s }));

    const event = mocks.record.mock.calls[0][0];
    expect(event).toMatchObject({
      action: "auth.password_reset",
      outcome: "FAILURE",
      targetUserId: "person-id",
    });
    expect(event.actorId).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("valid-reset-token");
  });

  it.each([
    ["a tampered signature", { e: "person@example.test", s: "tampered" }],
    ["a missing signature", {}],
  ])("resets the password but does not change User status for %s", async (_case, fields) => {
    await expect(
      resetPasswordAction(
        { error: null },
        validReset(fields),
      ),
    ).rejects.toThrow("redirect:/login?reset=1");

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("returning to a System after central login", () => {
  const request = {
    system: "CRMS",
    redirectUri: "https://crms.example.com/auth/callback",
    state: "correlation-state-0123456789",
    codeChallenge: "a".repeat(43),
  };
  const redirectsTo = (destination: string) => new Error(`redirect:${destination}`);
  const authorizePath = (token: string) => {
    const check = checkReturnIntent(token);
    if (check.status !== "valid") throw new Error("test token should be valid");
    return check.authorizePath;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEON_AUTH_COOKIE_SECRET = "a-test-secret-that-is-at-least-thirty-two-characters";
    mocks.findUnique.mockResolvedValue({
      id: "admin-id",
      email: "admin@example.com",
      isDeleted: false,
      mustChangePassword: false,
    });
    mocks.signInEmail.mockResolvedValue({ error: null });
    mocks.changePassword.mockResolvedValue({ error: null });
    mocks.update.mockResolvedValue({});
    vi.mocked(requirePasswordChangeUser).mockResolvedValue({
      id: "portal-user",
      username: "2026-ADMIN-001",
      firstName: "Jude",
      lastName: "Nitram",
      email: "admin@example.com",
      mustChangePassword: true,
      isAdministrator: false,
    });
  });

  const loginWith = (token?: string) => {
    const form = validForm();
    if (token !== undefined) form.set("ri", token);
    return loginAction({ error: null }, form);
  };

  const changeWith = (token?: string) => {
    const form = new FormData();
    form.set("currentPassword", "temporary-password");
    form.set("password", "new-password");
    form.set("confirmation", "new-password");
    if (token !== undefined) form.set("ri", token);
    return changePasswordAction({ error: null }, form);
  };

  it("resumes the original System request after a successful login", async () => {
    const token = issueReturnIntent(request);

    await expect(loginWith(token)).rejects.toThrow(redirectsTo(authorizePath(token)));
  });

  it("carries the request through the mandatory password change, then resumes it", async () => {
    const token = issueReturnIntent(request);
    mocks.findUnique.mockResolvedValue({
      id: "new-id",
      email: "new.user@example.com",
      isDeleted: false,
      mustChangePassword: true,
    });

    await expect(loginWith(token)).rejects.toThrow(
      redirectsTo(`/change-password?ri=${encodeURIComponent(token)}`),
    );
    await expect(changeWith(token)).rejects.toThrow(redirectsTo(authorizePath(token)));
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "portal-user" },
      data: { mustChangePassword: false },
    });
  });

  it("does not resume before the password change has actually succeeded", async () => {
    mocks.changePassword.mockResolvedValue({ error: { message: "invalid" } });

    await expect(changeWith(issueReturnIntent(request))).resolves.toEqual({
      error: "Your current password is incorrect.",
    });
  });

  it("falls back to the ordinary portal when there is no System request", async () => {
    await expect(loginWith()).rejects.toThrow(redirectsTo("/"));
    await expect(changeWith()).rejects.toThrow(redirectsTo("/"));
  });

  it.each([
    ["a tampered token", () => `${issueReturnIntent(request).split(".")[0]}.AAAA`],
    ["an arbitrary URL", () => "https://evil.example.com/phish"],
    ["a protocol-relative URL", () => "//evil.example.com"],
    ["an expired token", () => issueReturnIntent(request, new Date(Date.now() - RETURN_INTENT_TTL_MS - 1000))],
  ])("never follows %s: login still succeeds and lands on the portal", async (_name, token) => {
    await expect(loginWith(token())).rejects.toThrow(redirectsTo("/"));
    await expect(changeWith(token())).rejects.toThrow(redirectsTo("/"));
  });

  it("drops an unusable request but still sends a User awaiting first login to change their password", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "new-id",
      email: "new.user@example.com",
      isDeleted: false,
      mustChangePassword: true,
    });

    await expect(loginWith("//evil.example.com")).rejects.toThrow(redirectsTo("/change-password"));
  });

  it("keeps rejecting wrong credentials without leaking the request", async () => {
    mocks.signInEmail.mockResolvedValue({ error: { message: "bad" } });

    await expect(loginWith(issueReturnIntent(request))).resolves.toEqual({
      error: "Invalid credentials",
    });
  });
});
