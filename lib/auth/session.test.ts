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
  role: { isAdministrator: true, name: "Super Admin" },
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
      isAdministrator: true,
      roleName: "Super Admin",
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

  it("redirects a non-Administrator away from the admin area", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      role: { isAdministrator: false },
    });
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).rejects.toThrow(/^redirect:\/$/);
  });

  it("redirects an awaiting non-Super-Admin to the portal before password change", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
      role: { isAdministrator: false },
    });
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).rejects.toThrow(/^redirect:\/$/);
  });

  it("rechecks an Administrator's role on every request", async () => {
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).resolves.toMatchObject({ isAdministrator: true });

    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      role: { isAdministrator: false },
    });

    await expect(requireAdministrator()).rejects.toThrow("redirect:/");
  });

  it("allows a CEO because the current Role grants administrative authority", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeUser,
      role: { isAdministrator: true },
    });
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).resolves.toMatchObject({
      isAdministrator: true,
    });
  });

  it("denies a Deleted Administrator on the next administrative request", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, isDeleted: true });
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).rejects.toThrow("redirect:/login");
  });

  it("sends an Administrator Awaiting first login to password change", async () => {
    mocks.findUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const { requireAdministrator } = await import("./session");

    await expect(requireAdministrator()).rejects.toThrow("redirect:/change-password");
  });
});
