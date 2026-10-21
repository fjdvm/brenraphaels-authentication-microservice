// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AccessibleSystem } from "@/lib/portal/accessible-systems";

import { AccessSystemCards } from "./access-system-cards";

const crms: AccessibleSystem = {
  id: "crms",
  name: "CRMS",
  url: "https://crms.example.com",
  iconName: "users",
  description: "Customer profiles, orders, payments, conversations and support tickets.",
  grantedModules: 4,
  totalModules: 5,
};

describe("AccessSystemCards", () => {
  afterEach(cleanup);

  it("opens each Accessible System at its destination and says how many Modules the User holds", () => {
    render(<AccessSystemCards systems={[crms]} />);

    const card = screen.getByRole("link", { name: /CRMS/ });
    expect(card.getAttribute("href")).toBe("https://crms.example.com");
    expect(within(card).getByText("4 of 5 modules")).toBeTruthy();
    expect(within(card).getByText(crms.description!)).toBeTruthy();
    expect(within(card).getByText("Open CRMS")).toBeTruthy();
  });

  it("says one module, not one modules", () => {
    render(<AccessSystemCards systems={[{ ...crms, grantedModules: 1, totalModules: 1 }]} />);

    expect(screen.getByText("1 of 1 module")).toBeTruthy();
  });

  it("explains that access must be granted when there are no Systems", () => {
    render(<AccessSystemCards systems={[]} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No Systems available yet")).toBeTruthy();
  });
});
