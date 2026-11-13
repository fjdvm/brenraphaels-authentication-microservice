import { describe, expect, it } from "vitest";

import {
  filterRequests,
  groupAccess,
  summarizeRequests,
  tabCounts,
  type AccountRequestRow,
} from "./account-requests";

const row = (overrides: Partial<AccountRequestRow> & Pick<AccountRequestRow, "id" | "status">): AccountRequestRow => ({
  reference: "RQ-0001",
  sourceSystemName: "HRMS",
  personName: "Carla Domingo",
  workEmail: "carla@brenraphaels.ph",
  mobile: null,
  position: "Cashier",
  branch: "Cainta",
  startDate: "2026-11-03",
  neededFrom: "2026-11-02",
  note: null,
  requesterName: "Ana T.",
  roleName: "Staff / Employee",
  moduleIds: [],
  createdAt: "2026-11-12T01:40:00.000Z",
  accountCreatedAt: null,
  ...overrides,
});

const now = new Date("2026-11-13T00:00:00.000Z");

describe("account request summary", () => {
  const rows = [
    row({ id: "a", status: "new" }),
    row({ id: "b", status: "seen" }),
    row({ id: "c", status: "created", createdAt: "2026-11-10T00:00:00.000Z", accountCreatedAt: "2026-11-10T04:00:00.000Z" }),
    row({ id: "d", status: "created", createdAt: "2026-10-01T00:00:00.000Z", accountCreatedAt: "2026-10-01T06:00:00.000Z" }),
    row({ id: "e", status: "declined" }),
    row({ id: "f", status: "cancelled" }),
  ];

  it("counts new (incl. seen), created this month in Philippine time, declined and the average wait", () => {
    expect(summarizeRequests(rows, now)).toEqual({ new: 2, createdThisMonth: 1, declined: 1, averageWaitHours: 5 });
  });

  it("has no average wait until an account was created", () => {
    expect(summarizeRequests([row({ id: "a", status: "new" })], now).averageWaitHours).toBeNull();
  });

  it("filters by tab and counts each tab; All leaves out nothing", () => {
    expect(filterRequests(rows, "new").map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterRequests(rows, "created").map((r) => r.id)).toEqual(["c", "d"]);
    expect(filterRequests(rows, "declined").map((r) => r.id)).toEqual(["e"]);
    expect(filterRequests(rows, "all")).toHaveLength(6);
    expect(tabCounts(rows)).toEqual({ new: 2, created: 2, declined: 1, all: 6 });
  });
});

describe("groupAccess", () => {
  const systems = [
    { id: "s1", name: "POS", modules: [{ id: "m1", name: "Dashboard" }, { id: "m2", name: "Sales" }] },
    { id: "s2", name: "CRMS", modules: [{ id: "m3", name: "Orders" }] },
  ];

  it("groups requested modules by system and lists systems with nothing requested", () => {
    expect(groupAccess(systems, ["m2", "m1"])).toEqual({
      groups: [{ system: "POS", requested: 2, total: 2, modules: [{ name: "Dashboard", requested: true }, { name: "Sales", requested: true }] }],
      untouched: ["CRMS"],
    });
  });

  it("shows every module of a touched system, ticking the requested ones", () => {
    const [group] = groupAccess(systems, ["m3"]).groups;
    expect(group).toMatchObject({ system: "CRMS", requested: 1, total: 1 });
  });
});
