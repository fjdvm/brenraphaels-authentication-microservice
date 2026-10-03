import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findMany: mocks.findMany } },
}));

describe("listUsers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("labels every User with their current derived status", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "active",
        username: "2026-JN-002",
        firstName: "Jude",
        lastName: "Nitram",
        email: "jude@example.com",
        isDeleted: false,
        mustChangePassword: false,
        role: { name: "Manager" },
      },
      {
        id: "awaiting",
        username: "2026-AR-003",
        firstName: "Ari",
        lastName: "Reyes",
        email: "ari@example.com",
        isDeleted: false,
        mustChangePassword: true,
        role: { name: "Cashier" },
      },
      {
        id: "deleted",
        username: "2026-KL-004",
        firstName: "Kai",
        lastName: "Lim",
        email: "kai@example.com",
        isDeleted: true,
        mustChangePassword: false,
        role: { name: "Cashier" },
      },
    ]);

    const { listUsers } = await import("./users");

    await expect(listUsers()).resolves.toEqual([
      expect.objectContaining({ username: "2026-JN-002", status: "Active" }),
      expect.objectContaining({ username: "2026-AR-003", status: "Awaiting first login" }),
      expect.objectContaining({ username: "2026-KL-004", status: "Deleted" }),
    ]);
  });

  it("keeps a Deleted User deleted even when their password must be changed", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "deleted-awaiting",
        username: "2026-KL-004",
        firstName: "Kai",
        lastName: "Lim",
        email: "kai@example.com",
        isDeleted: true,
        mustChangePassword: true,
        role: { name: "Cashier" },
      },
    ]);

    const { listUsers } = await import("./users");

    await expect(listUsers()).resolves.toEqual([
      expect.objectContaining({ status: "Deleted" }),
    ]);
  });
});
