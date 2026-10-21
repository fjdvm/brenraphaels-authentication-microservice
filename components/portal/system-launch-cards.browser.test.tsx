// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SystemLaunchCards } from "./system-launch-cards";

const ims = {
  id: "ims",
  name: "IMS",
  url: "https://ims.example.com/app",
  iconName: "package",
  description: "Suppliers, procurement, inventory, production and distribution.",
  grantedModules: 6,
  totalModules: 6,
};
const pos = {
  id: "pos",
  name: "POS",
  url: "https://pos.example.com",
  iconName: "store",
  description: "Sales and orders.",
  grantedModules: 2,
  totalModules: 7,
};

describe("SystemLaunchCards", () => {
  afterEach(cleanup);

  it("renders one launch card per accessible System with its identity and open its destination", () => {
    render(<SystemLaunchCards systems={[ims, pos]} />);

    const imsLink = screen.getByRole("link", { name: /IMS/ });
    expect(imsLink.getAttribute("href")).toBe("https://ims.example.com/app");
    expect(screen.getByText(ims.description)).toBeTruthy();
    expect(screen.queryByText("ims.example.com")).toBeNull();
    expect(screen.getByRole("link", { name: /POS/ }).getAttribute("href")).toBe("https://pos.example.com");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("lays out at most two columns, and a single column for a single card", () => {
    const { container, rerender } = render(<SystemLaunchCards systems={[ims, pos]} />);
    const list = () => container.querySelector("ul")!;

    expect(list().className).toContain("sm:grid-cols-2");
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
