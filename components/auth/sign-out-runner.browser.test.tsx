// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const logoutAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/auth", () => ({ logoutAction }));

import { SignOutRunner } from "./sign-out-runner";

afterEach(() => {
  cleanup();
  logoutAction.mockReset();
});

describe("SignOutRunner", () => {
  it("runs the sign-out Server Action once when the page opens", () => {
    render(<SignOutRunner />);

    expect(screen.getByRole("status").textContent).toMatch(/signing you out/i);
    expect(logoutAction).toHaveBeenCalledOnce();
  });
});
