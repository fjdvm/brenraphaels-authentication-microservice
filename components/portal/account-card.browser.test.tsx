// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountCard } from "./account-card";

describe("AccountCard", () => {
  afterEach(cleanup);

  it("shows the signed-in User's account and links to their own Activity log (My Logs)", () => {
    render(<AccountCard user={{ username: "2026-FM-008", email: "fitz@example.com", roleName: "Staff / Employee" }} />);

    expect(screen.getByRole("heading", { name: "Your account" })).toBeTruthy();
    expect(screen.getByText("2026-FM-008")).toBeTruthy();
    expect(screen.getByText("fitz@example.com")).toBeTruthy();
    expect(screen.getByText("Staff / Employee")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View activity log" }).getAttribute("href")).toBe("/my-logs");
  });
});
