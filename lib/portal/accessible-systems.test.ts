import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findSystems: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { accessGrant: { findMany: mocks.findMany }, system: { findMany: mocks.findSystems } },
}));

const posRow = { id: "pos", name: "POS", url: "https://pos.example", iconName: "store", description: "Sales", _count: { modules: 7 } };
const imsRow = { id: "ims", name: "IMS", url: "https://ims.example", iconName: "package", description: "Stock", _count: { modules: 6 } };
const pos = { id: "pos", name: "POS", url: "https://pos.example", iconName: "store", description: "Sales", grantedModules: 1, grantedModuleNames: ["m"], totalModules: 7 };
const ims = { id: "ims", name: "IMS", url: "https://ims.example", iconName: "package", description: "Stock", grantedModules: 1, grantedModuleNames: ["m"], totalModules: 6 };

let nextModule = 0;

function grant(
  system: typeof posRow,
  revokedAt: Date | null = null,
  isDeleted = false,
  moduleId = `m${nextModule++}`,
  moduleName = "m",
) {
  return { revokedAt, user: { isDeleted }, module: { id: moduleId, name: moduleName, system } };
}

describe("listAccessibleSystems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns one entry per System however many active Module grants the User holds", async () => {
    mocks.findMany.mockResolvedValue([grant(posRow), grant(posRow), grant(imsRow)]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([
      ims,
      { ...pos, grantedModules: 2, grantedModuleNames: ["m", "m"] },
    ]);
  });

  it("counts each Module the User can open once, out of all the System's Modules", async () => {
    mocks.findMany.mockResolvedValue([
      grant(posRow, new Date(), false, "sales", "Sales"),
      grant(posRow, null, false, "sales", "Sales"),
      grant(posRow, new Date(), false, "stock", "Stock"),
    ]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    await expect(listAccessibleSystems("user-1")).resolves.toEqual([
      { ...pos, grantedModules: 1, grantedModuleNames: ["Sales"], totalModules: 7 },
    ]);
  });

  it("names the Modules the User can open, alphabetically", async () => {
    mocks.findMany.mockResolvedValue([
      grant(posRow, null, false, "stock", "Stock"),
      grant(posRow, null, false, "branches", "Branches"),
      grant(posRow, new Date(), false, "sales", "Sales"),
    ]);
    const { listAccessibleSystems } = await import("./accessible-systems");

    const [system] = await listAccessibleSystems("user-1");
    expect(system.grantedModuleNames).toEqual(["Branches", "Stock"]);
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

describe("listSystemNames", () => {
  it("names every System, whether or not the User can open it", async () => {
    mocks.findSystems.mockResolvedValue([{ name: "CRMS" }, { name: "HRMS" }]);
    const { listSystemNames } = await import("./accessible-systems");

    await expect(listSystemNames()).resolves.toEqual(["CRMS", "HRMS"]);
    expect(mocks.findSystems).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: "asc" } }));
  });
});
