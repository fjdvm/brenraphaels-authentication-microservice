import { expect, it } from "vitest";

import { uiLabel } from "./ui-label";

it("shows CRMS as CREOMS, whole word only, and leaves everything else alone", () => {
  expect(uiLabel("CRMS")).toBe("CREOMS");
  expect(uiLabel("CRMS Manager")).toBe("CREOMS Manager");
  expect(uiLabel("CREOMS Manager")).toBe("CREOMS Manager");
  expect(uiLabel("HRMS")).toBe("HRMS");
  expect(uiLabel("XCRMSX")).toBe("XCRMSX");
});
