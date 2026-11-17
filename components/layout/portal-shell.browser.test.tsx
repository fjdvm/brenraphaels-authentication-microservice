// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({ logoutAction: vi.fn() }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { PortalShell } from "./portal-shell";

const user = { firstName: "Fitz", lastName: "Martin", roleName: "Staff / Employee" };

describe("PortalShell", () => {
  afterEach(cleanup);

  it("is a top bar without a sidebar: lockup, bell, who is signed in and a text-only Log out", () => {
    vi.stubGlobal("fetch", async () => Response.json({ available: true, unread: 0, notifications: [] }));
    render(
      <PortalShell user={user}>
        <p>page</p>
      </PortalShell>,
    );

    expect(screen.getByText("Fitz Martin")).toBeTruthy();
    expect(screen.getByText("Staff / Employee")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    const logOut = screen.getByRole("button", { name: "Log out" });
    expect(logOut.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("page")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
