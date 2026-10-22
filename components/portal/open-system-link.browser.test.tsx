// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenSystemLink } from "./open-system-link";

describe("OpenSystemLink", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the System in a new tab and shows the loading card until the System responds", async () => {
    let respond!: () => void;
    const fetchMock = vi.fn(() => new Promise<void>((resolve) => (respond = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    render(<OpenSystemLink name="CRMS" url="https://crms.example.com" />);
    const link = screen.getByRole("link", { name: /Open CRMS/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");

    fireEvent.click(link);
    expect(screen.getByText("Opening CRMS…")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("https://crms.example.com", expect.objectContaining({ mode: "no-cors" }));

    await act(async () => respond());
    expect(screen.queryByText("Opening CRMS…")).toBeNull();
  });

  it("stops showing the loading card after 15 seconds if the System never answers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    render(<OpenSystemLink name="CRMS" url="https://crms.example.com" />);
    fireEvent.click(screen.getByRole("link", { name: /Open CRMS/ }));
    expect(screen.getByText("Opening CRMS…")).toBeTruthy();

    await act(async () => void vi.advanceTimersByTime(15_000));
    expect(screen.queryByText("Opening CRMS…")).toBeNull();
  });

  it("shows nothing for a click that already opens a new tab", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<OpenSystemLink name="CRMS" url="https://crms.example.com" />);
    fireEvent.click(screen.getByRole("link", { name: /Open CRMS/ }), { ctrlKey: true });

    expect(screen.queryByText("Opening CRMS…")).toBeNull();
  });
});
