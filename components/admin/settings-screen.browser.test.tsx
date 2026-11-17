// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsScreen } from "./settings-screen";

afterEach(cleanup);
const targets = { firstReplyHours: 24, resolveHours: 72 };

describe("Settings screen", () => {
  it("shows the General tab as an Admin: breadcrumb, Role pill, Approval limit only, Save changes", () => {
    render(<SettingsScreen canEdit centavos={500000} roleName="Admin" targets={targets} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
    expect(screen.getByText("/ General")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["General", "Service levels"]);
    expect(screen.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Approval limit" })).toBeTruthy();
    expect(screen.getByText("Only an Admin can change this. Every change is logged. Requests keep the limit that applied when they were sent.")).toBeTruthy();
    expect((screen.getByLabelText("Limit in pesos") as HTMLInputElement).value).toBe("5000");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });

  it("shows the Service levels tab as an Admin with the two targets", async () => {
    render(<SettingsScreen canEdit centavos={500000} roleName="Admin" targets={targets} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "Service levels" }));
    expect(screen.getByText("/ Service levels")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("SLA, triage & routing");
    expect((screen.getByLabelText("First reply target (hours)") as HTMLInputElement).value).toBe("24");
    expect((screen.getByLabelText("Resolve target (hours)") as HTMLInputElement).value).toBe("72");
    expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(1);
  });

  it("shows both tabs to a CEO read-only: values, no inputs, no Save", async () => {
    render(<SettingsScreen canEdit={false} centavos={500000} roleName="CEO" targets={targets} />);
    const user = userEvent.setup();
    expect(screen.getByText("CEO")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Limit in pesos" }).textContent).toBe("₱5,000");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Service levels" }));
    expect(screen.getByRole("group", { name: "First reply target (hours)" }).textContent).toBe("24");
    expect(screen.getByRole("group", { name: "Resolve target (hours)" }).textContent).toBe("72");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
