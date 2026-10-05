import { describe, expect, it } from "vitest";

import { isSystemFullySelected, toggleModule, toggleSystem, type SelectableSystem } from "./module-selection";

const pos: SelectableSystem = {
  id: "s1",
  name: "POS",
  modules: [
    { id: "p1", name: "Dashboard" },
    { id: "p2", name: "Sales Processing" },
  ],
};

describe("module selection", () => {
  it("toggles a single Module on and off", () => {
    expect(toggleModule(["c1"], "p1")).toEqual(["c1", "p1"]);
    expect(toggleModule(["c1", "p1"], "p1")).toEqual(["c1"]);
  });

  it("Select all checks every Module of one System and leaves other Systems alone", () => {
    expect(toggleSystem(pos, ["c1", "p2"]).sort()).toEqual(["c1", "p1", "p2"]);
  });

  it("Select all clears the System when it is already fully selected", () => {
    expect(toggleSystem(pos, ["c1", "p1", "p2"])).toEqual(["c1"]);
  });

  it("knows whether a System is fully selected", () => {
    expect(isSystemFullySelected(pos, ["p1"])).toBe(false);
    expect(isSystemFullySelected(pos, ["p1", "p2"])).toBe(true);
    expect(isSystemFullySelected({ ...pos, modules: [] }, [])).toBe(false);
  });
});
