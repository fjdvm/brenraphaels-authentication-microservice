import { beforeEach, describe, expect, it, vi } from "vitest";

const logoutAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/auth", () => ({ logoutAction }));

import { GET, POST } from "./route";

describe("/logout", () => {
  beforeEach(() => {
    logoutAction.mockReset();
    logoutAction.mockRejectedValue(new Error("redirect:/login"));
  });

  it("signs out and lands on login when a System's 303 arrives as a GET", async () => {
    await expect(GET()).rejects.toThrow("redirect:/login");
    expect(logoutAction).toHaveBeenCalledOnce();
  });

  it("does the same for a POST", async () => {
    await expect(POST()).rejects.toThrow("redirect:/login");
    expect(logoutAction).toHaveBeenCalledOnce();
  });
});
