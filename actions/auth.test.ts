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
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  logoutAction,
  resetPasswordAction,
} from "./auth";
import { requirePasswordChangeUser } from "@/lib/auth/session";
import { resetLinkParams } from "@/lib/auth/reset-link";

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
      select: { email: true, isDeleted: true, mustChangePassword: true },
    });
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "password",
    });
  });

  it.each([
    ["unknown Username", null, { error: null }],
    ["Deleted User", { email: "deleted@example.com", isDeleted: true, mustChangePassword: false }, { error: null }],
    ["wrong password", { email: "admin@example.com", isDeleted: false, mustChangePassword: false }, { error: { message: "invalid" } }],
  ])("returns the same error for a %s", async (_case, user, signInResult) => {
    mocks.findUnique.mockResolvedValue(user);
    mocks.signInEmail.mockResolvedValue(signInResult);

    await expect(loginAction({ error: null }, validForm())).resolves.toEqual({
      error: "Invalid credentials",
    });
  });

  it("sends a User awaiting first login to change their password", async () => {
    mocks.findUnique.mockResolvedValue({
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
      isSuperAdmin: true,
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
    mocks.findUnique.mockResolvedValue({ isDeleted: false });

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
      select: { isDeleted: true },
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
