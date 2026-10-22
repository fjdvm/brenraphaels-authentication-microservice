// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SystemLaunchCards } from "./system-launch-cards";

const ims = {
  id: "ims",
  name: "IMS",
  url: "https://ims.example.com/app",
  iconName: "package",
  description: "Suppliers, procurement, inventory, production and distribution.",
};
const pos = {
  id: "pos",
  name: "POS",
  url: "https://pos.example.com",
  iconName: "store",
  description: "Sales and orders.",
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

  it("opens each System in a new tab and shows loading on its card until the System responds", async () => {
    let respond!: () => void;
    const fetchMock = vi.fn(() => new Promise<void>((resolve) => (respond = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    render(<SystemLaunchCards systems={[ims, pos]} />);
    const imsLink = screen.getByRole("link", { name: /IMS/ });
    expect(imsLink.getAttribute("target")).toBe("_blank");
    expect(imsLink.getAttribute("rel")).toContain("noopener");

    fireEvent.click(imsLink);
    expect(screen.getByText("Opening IMS…")).toBeTruthy();
    expect(screen.queryByText("Opening POS…")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(ims.url, expect.objectContaining({ mode: "no-cors" }));

    await act(async () => {
      respond();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByText("Opening IMS…")).toBeNull();

    vi.useRealTimers();
    vi.unstubAllGlobals();
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
