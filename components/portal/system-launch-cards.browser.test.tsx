// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AccessibleSystem } from "@/lib/portal/accessible-systems";

import { SystemLaunchCards } from "./system-launch-cards";

const ims: AccessibleSystem = {
  id: "ims",
  name: "IMS",
  url: "https://ims.example.com/app",
  iconName: "package",
  description: "Suppliers, procurement, inventory, production and distribution.",
  grantedModules: 6,
  grantedModuleNames: ["Distribution", "Inventory", "Procurement", "Production", "Stock", "Suppliers"],
  totalModules: 6,
};
const pos: AccessibleSystem = {
  id: "pos",
  name: "POS",
  url: "https://pos.example.com",
  iconName: "store",
  description: "Sales and orders.",
  grantedModules: 2,
  grantedModuleNames: ["Orders", "Sales"],
  totalModules: 7,
};

describe("SystemLaunchCards", () => {
  afterEach(cleanup);

  it("renders one launch card per accessible System with its identity and open its destination", () => {
    render(<SystemLaunchCards systems={[ims, pos]} />);

    const imsLink = screen.getByRole("link", { name: "Open IMS" });
    expect(imsLink.getAttribute("href")).toBe("https://ims.example.com/app");
    expect(screen.getByRole("heading", { name: "IMS" })).toBeTruthy();
    expect(screen.getByText(ims.description!)).toBeTruthy();
    expect(screen.queryByText("ims.example.com")).toBeNull();
    expect(screen.getByRole("link", { name: "Open POS" }).getAttribute("href")).toBe("https://pos.example.com");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("names the Modules the User holds and how many of the System's Modules that is", () => {
    render(<SystemLaunchCards systems={[pos]} />);

    const modules = screen.getByRole("list", { name: "POS modules" });
    expect(within(modules).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Orders", "Sales"]);
    expect(screen.getByText("2 of 7 modules")).toBeTruthy();
  });

  it("lays out at most two columns, and a single column for a single card", () => {
    const { container, rerender } = render(<SystemLaunchCards systems={[ims, pos]} />);
    const list = () => container.querySelector("ul")!;

    expect(list().className).toContain("xl:grid-cols-2");
    expect(list().className).not.toContain("grid-cols-3");

    rerender(<SystemLaunchCards systems={[pos]} />);
    expect(list().className).not.toContain("grid-cols");
  });

  it("shows no card for a System the User cannot access", () => {
    render(<SystemLaunchCards systems={[pos]} />);

    expect(screen.queryByRole("link", { name: /IMS/ })).toBeNull();
    expect(screen.queryByText("SCMS")).toBeNull();
  });

  it("explains that an Administrator must grant access when there are no Accessible Systems", () => {
    render(<SystemLaunchCards systems={[]} />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("No Systems available yet")).toBeTruthy();
    expect(screen.getByText(/administrator/i)).toBeTruthy();
  });
});

describe("Opening a System", () => {
  afterEach(cleanup);

  // jsdom can't navigate; stop the browser leaving so the card can be inspected.
  const clickOpen = (name: string, init?: MouseEventInit) => {
    const link = screen.getByRole("link", { name });
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(link, init);
  };

  it("shows the Opening card for that System while the browser leaves for it", () => {
    render(<SystemLaunchCards systems={[ims, pos]} />);
    expect(screen.queryByRole("status")).toBeNull();

    clickOpen("Open POS");

    const card = screen.getByRole("status", { name: "Opening POS…" });
    expect(within(card).getByText("Handing your sign-in over securely")).toBeTruthy();
  });

  it("shows nothing when the System opens in a new tab", () => {
    render(<SystemLaunchCards systems={[pos]} />);

    clickOpen("Open POS", { ctrlKey: true });
    clickOpen("Open POS", { metaKey: true });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the card when the browser comes back to this page from its history", () => {
    render(<SystemLaunchCards systems={[pos]} />);
    clickOpen("Open POS");

    const restored = new Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    fireEvent(window, restored);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
