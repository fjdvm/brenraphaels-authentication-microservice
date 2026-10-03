import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

vi.mock("@/lib/auth/server", () => ({
  auth: { signIn: { email: mocks.signInEmail }, signOut: mocks.signOut },
}));

vi.mock("@/lib/auth/session", () => ({
  requirePortalUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { loginAction, logoutAction } from "./auth";

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
