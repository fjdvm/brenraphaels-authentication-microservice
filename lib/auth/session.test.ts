import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: mocks.getSession },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const activeUser = {
  id: "portal-user",
  username: "2026-ADMIN-001",
  firstName: "Jude",
  lastName: "Nitram",
  email: "admin@example.com",
  mustChangePassword: false,
  isDeleted: false,
  role: { isSuperAdmin: true },
};

describe("requirePortalUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { user: { id: "neon-user" } } });
    mocks.findUnique.mockResolvedValue(activeUser);
  });

  it("redirects visitors without a session to login", async () => {
    mocks.getSession.mockResolvedValue({ data: null });
    const { requirePortalUser } = await import("./session");

    await expect(requirePortalUser()).rejects.toThrow("redirect:/login");
  });

  it("treats a User deleted after sign-in as signed out on the next request", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, isDeleted: true });
    const { requirePortalUser } = await import("./session");

    await expect(requirePortalUser()).rejects.toThrow("redirect:/login");
  });

  it("requires an awaiting User to change their password before entering the portal", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const { requirePortalUser } = await import("./session");

    await expect(requirePortalUser()).rejects.toThrow("redirect:/change-password");
  });

  it("returns an active User", async () => {
    const { requirePortalUser } = await import("./session");

    await expect(requirePortalUser()).resolves.toMatchObject({
      id: "portal-user",
      username: "2026-ADMIN-001",
      isSuperAdmin: true,
    });
  });

  it("allows an awaiting User onto the change-password route", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const { requirePortalUser } = await import("./session");

    await expect(
      requirePortalUser({ allowMustChangePassword: true }),
    ).resolves.toMatchObject({ mustChangePassword: true });
  });

  it("does not send an active User through the password-change route again", async () => {
    const { requirePasswordChangeUser } = await import("./session");

    await expect(requirePasswordChangeUser()).rejects.toThrow("redirect:/");
  });

  it("allows a User Awaiting first login through the password-change guard", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const { requirePasswordChangeUser } = await import("./session");

    await expect(requirePasswordChangeUser()).resolves.toMatchObject({
      mustChangePassword: true,
    });
  });

  it("redirects a non-Super-Admin away from the admin area", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      role: { isSuperAdmin: false },
    });
    const { requireSuperAdmin } = await import("./session");

    await expect(requireSuperAdmin()).rejects.toThrow(/^redirect:\/$/);
  });

  it("redirects an awaiting non-Super-Admin to the portal before password change", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
      role: { isSuperAdmin: false },
    });
    const { requireSuperAdmin } = await import("./session");

    await expect(requireSuperAdmin()).rejects.toThrow(/^redirect:\/$/);
  });

  it("rechecks a Super Admin's role on every request", async () => {
    const { requireSuperAdmin } = await import("./session");

    await expect(requireSuperAdmin()).resolves.toMatchObject({ isSuperAdmin: true });

    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      role: { isSuperAdmin: false },
    });

    await expect(requireSuperAdmin()).rejects.toThrow("redirect:/");
  });
});
