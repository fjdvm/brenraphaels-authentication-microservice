// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccountCard } from "./account-card";

const account = { username: "2026-FM-008", email: "fitz@example.com", roleName: "Staff/Employee" };

describe("AccountCard", () => {
  afterEach(cleanup);

  it("shows the User's Username, Email and Role", () => {
    render(<AccountCard {...account} lastSignIn="Today, 2:10 PM" otherSystemNames={[]} />);

    const card = screen.getByRole("region", { name: "Your account" });
    expect(within(card).getByText("2026-FM-008")).toBeTruthy();
    expect(within(card).getByText("fitz@example.com")).toBeTruthy();
    expect(within(card).getByText("Staff/Employee")).toBeTruthy();
    expect(within(card).getByText("Today, 2:10 PM")).toBeTruthy();
  });

  it("shows a dash when there is no previous sign-in", () => {
    render(<AccountCard {...account} lastSignIn={null} otherSystemNames={[]} />);

    expect(screen.getByText("Last sign-in").nextElementSibling?.textContent).toBe("—");
  });

  it("changes the password through the Forgot password email", () => {
    render(<AccountCard {...account} lastSignIn={null} otherSystemNames={[]} />);

    expect(screen.getByRole("link", { name: "Change password" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("names the Systems the User can't open and who grants them", () => {
    const { rerender } = render(
      <AccountCard {...account} lastSignIn={null} otherSystemNames={["HRMS", "IMS", "POS"]} />,
    );
    expect(screen.getByText("Need HRMS, IMS or POS? Ask a Super Admin to update your access.")).toBeTruthy();

    rerender(<AccountCard {...account} lastSignIn={null} otherSystemNames={["POS"]} />);
    expect(screen.getByText("Need POS? Ask a Super Admin to update your access.")).toBeTruthy();

    rerender(<AccountCard {...account} lastSignIn={null} otherSystemNames={[]} />);
    expect(screen.queryByText(/Ask a Super Admin/)).toBeNull();
  });
});
