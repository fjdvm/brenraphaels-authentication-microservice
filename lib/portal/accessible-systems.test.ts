import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { accessGrant: { findMany: mocks.findMany } },
}));

const pos = { id: "pos", name: "POS", url: "https://pos.example", iconName: "store", description: "Sales" };
const ims = { id: "ims", name: "IMS", url: "https://ims.example", iconName: "package", description: "Stock" };

function grant(system: typeof pos, revokedAt: Date | null = null, isDeleted = false) {
  return { revokedAt, user: { isDeleted }, module: { system } };
}

describe("listAccessibleSystems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns one entry per System however many active Module grants the User holds", async () => {
    mocks.findMany.mockResolvedValue([grant(pos), grant(pos), grant(ims)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([ims, pos]);
  });

  it("omits a System once every grant in it has been revoked, keeping others", async () => {
    mocks.findMany.mockResolvedValue([grant(pos, new Date()), grant(ims)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([ims]);
  });

  it("keeps a System while at least one of its grants is still active", async () => {
    mocks.findMany.mockResolvedValue([grant(pos, new Date()), grant(pos)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([pos]);
  });

  it("returns nothing for a Deleted User or a User with no grants", async () => {
    const { listAccessibleSystems } = await import("./accessible-systems");

    mocks.findMany.mockResolvedValue([grant(pos, null, true)]);
    await expect(listAccessibleSystems("user-1")).resolves.toEqual([]);

    mocks.findMany.mockResolvedValue([]);
    await expect(listAccessibleSystems("user-2")).resolves.toEqual([]);
  });
});
