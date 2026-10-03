import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  signInEmail: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    signIn: { email: mocks.signInEmail },
    signOut: mocks.signOut,
    changePassword: mocks.changePassword,
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requirePasswordChangeUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { changePasswordAction, loginAction, logoutAction } from "./auth";
import { requirePasswordChangeUser } from "@/lib/auth/session";

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
