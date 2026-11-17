// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SystemLogsHeading } from "./page-headings";

afterEach(cleanup);

describe("SystemLogsHeading", () => {
  it.each(["Admin", "CEO"])("shows the Figma description and the %s role pill", (roleName) => {
    render(<SystemLogsHeading roleName={roleName} />);

    expect(screen.getByRole("heading", { name: "System logs" })).toBeTruthy();
    expect(screen.getByText(roleName)).toBeTruthy();
    expect(
      screen.getByText("Every portal sign-in, sign-out and password event. Times are shown in Philippine time (UTC+8)."),
    ).toBeTruthy();
  });
});
