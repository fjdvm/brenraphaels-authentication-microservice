// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { AccountRequestRow } from "@/lib/admin/account-requests";

import { AccountRequestsView } from "./account-requests-view";

const request = (overrides: Partial<AccountRequestRow> & Pick<AccountRequestRow, "id" | "status">): AccountRequestRow => ({
  reference: "RQ-0001",
  sourceSystemName: "HRMS",
  personName: "Carla Domingo",
  workEmail: "carla@brenraphaels.ph",
  mobile: "0917 220 4410",
  position: "Cashier",
  branch: "Cainta",
  startDate: "2026-11-03",
  neededFrom: "2026-11-02",
  note: "Please don't give her price changes.",
  requesterName: "Ana T.",
  roleName: "Staff / Employee",
  moduleIds: ["m1", "m2"],
  createdAt: "2026-11-13T01:40:00.000Z",
  accountCreatedAt: null,
  ...overrides,
});

const systems = [
  { id: "s1", name: "POS", modules: [{ id: "m1", name: "Dashboard" }, { id: "m2", name: "Sales Processing" }, { id: "m5", name: "Reports" }] },
  { id: "s2", name: "CRMS", modules: [{ id: "m3", name: "Orders" }] },
];
const now = "2026-11-13T04:00:00.000Z";
const heading = <h1>Account requests</h1>;

afterEach(cleanup);

describe("AccountRequestsView", () => {
  const requests = [
    request({ id: "a", status: "new" }),
    request({ id: "b", status: "declined", personName: "Mark Villanueva", reference: "RQ-0002" }),
  ];

  it("shows summary cards, tab counts and only New requests first", () => {
    render(<AccountRequestsView heading={heading} now={now} requests={requests} systems={systems} />);

    expect(screen.getByRole("tab", { name: "New 1" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Declined 1" })).toBeTruthy();
    expect(screen.getByText("Carla Domingo")).toBeTruthy();
    expect(screen.queryByText("Mark Villanueva")).toBeNull();
  });

  it("switches tabs", async () => {
    render(<AccountRequestsView heading={heading} now={now} requests={requests} systems={systems} />);
    await userEvent.click(screen.getByRole("tab", { name: "All" }));

    expect(screen.getByText("Mark Villanueva")).toBeTruthy();
  });

  it("opens the detail dialog with access grouped by system and inert action buttons", async () => {
    render(<AccountRequestsView heading={heading} now={now} requests={requests} systems={systems} />);
    await userEvent.click(screen.getByText("Carla Domingo"));

    const dialog = screen.getByRole("dialog");
    const checkbox = (name: string) => within(dialog).getByRole("checkbox", { name }) as HTMLInputElement;
    const button = (name: string) => within(dialog).getByRole("button", { name }) as HTMLButtonElement;
    expect(within(dialog).getByText(/Account request · RQ-0001/)).toBeTruthy();
    expect(within(dialog).getByText("Note from Ana")).toBeTruthy();
    expect(within(dialog).getByText("2 of 3 modules")).toBeTruthy();
    expect(checkbox("Dashboard").checked).toBe(true);
    expect(checkbox("Reports").checked).toBe(false);
    expect(within(dialog).getByText(/No access requested for CRMS/)).toBeTruthy();
    expect(button("Create account").disabled).toBe(true);
    expect(button("Decline…").disabled).toBe(true);
  });

  it("explains an empty list", () => {
    render(<AccountRequestsView heading={heading} now={now} requests={[]} systems={systems} />);

    expect(screen.getByText(/No account requests yet/)).toBeTruthy();
  });

  it("shows an error with Retry when requests could not be read", () => {
    render(<AccountRequestsView heading={heading} now={now} requests={null} systems={[]} />);

    expect(screen.getByRole("alert").textContent).toContain("Could not load Account requests");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
