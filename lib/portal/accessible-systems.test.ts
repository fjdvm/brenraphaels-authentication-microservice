import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { accessGrant: { findMany: mocks.findMany } },
}));

const posRow = { id: "pos", name: "POS", url: "https://pos.example", iconName: "store", description: "Sales", _count: { modules: 7 } };
const imsRow = { id: "ims", name: "IMS", url: "https://ims.example", iconName: "package", description: "Stock", _count: { modules: 6 } };
const pos = { id: "pos", name: "POS", url: "https://pos.example", iconName: "store", description: "Sales", grantedModules: 1, totalModules: 7 };
const ims = { id: "ims", name: "IMS", url: "https://ims.example", iconName: "package", description: "Stock", grantedModules: 1, totalModules: 6 };

let nextModule = 0;

function grant(system: typeof posRow, revokedAt: Date | null = null, isDeleted = false, moduleId = `m${nextModule++}`) {
  return { revokedAt, user: { isDeleted }, module: { id: moduleId, system } };
}

describe("listAccessibleSystems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns one entry per System however many active Module grants the User holds", async () => {
    mocks.findMany.mockResolvedValue([grant(posRow), grant(posRow), grant(imsRow)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([ims, { ...pos, grantedModules: 2 }]);
  });

  it("counts each Module the User can open once, out of all the System's Modules", async () => {
    mocks.findMany.mockResolvedValue([
      grant(posRow, new Date(), false, "sales"),
      grant(posRow, null, false, "sales"),
      grant(posRow, new Date(), false, "stock"),
    ]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([{ ...pos, grantedModules: 1, totalModules: 7 }]);
  });

  it("omits a System once every grant in it has been revoked, keeping others", async () => {
    mocks.findMany.mockResolvedValue([grant(posRow, new Date()), grant(imsRow)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([ims]);
  });

  it("keeps a System while at least one of its grants is still active", async () => {
    mocks.findMany.mockResolvedValue([grant(posRow, new Date()), grant(posRow)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([pos]);
  });

  it("returns nothing for a Deleted User or a User with no grants", async () => {
    const { listAccessibleSystems } = await import("./accessible-systems");

    mocks.findMany.mockResolvedValue([grant(posRow, null, true)]);
    await expect(listAccessibleSystems("user-1")).resolves.toEqual([]);

    mocks.findMany.mockResolvedValue([]);
    await expect(listAccessibleSystems("user-2")).resolves.toEqual([]);
  });
});
