import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  resendCredentials: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("@/lib/admin/credential-resend", () => ({ resendCredentials: mocks.resendCredentials }));
vi.mock("@/lib/admin/credential-resend.server", () => ({ createProductionResendPorts: () => ({}) }));
vi.mock("@/lib/admin/user-provisioning.server", () => ({ createProductionProvisioningPorts: () => ({}) }));
vi.mock("@/lib/admin/user-provisioning", () => ({ provisionUser: vi.fn() }));
vi.mock("@/lib/admin/user-access", () => ({ updateUserAccess: vi.fn() }));
vi.mock("@/lib/admin/user-access.server", () => ({ createProductionAccessPorts: vi.fn() }));

import { resendCredentialsAction } from "./users";

beforeEach(() => vi.clearAllMocks());

describe("resendCredentialsAction", () => {
  it("does nothing for a requester who is not an Administrator", async () => {
    mocks.requireAdministrator.mockRejectedValue(new Error("redirect:/"));

    await expect(resendCredentialsAction("user-1")).rejects.toThrow("redirect:/");
    expect(mocks.resendCredentials).not.toHaveBeenCalled();
  });

  it("reports success without any password", async () => {
    mocks.requireAdministrator.mockResolvedValue({ id: "admin-1" });
    mocks.resendCredentials.mockResolvedValue({ ok: true, username: "2026-JD-001" });

    const result = await resendCredentialsAction("user-1");

    expect(mocks.resendCredentials).toHaveBeenCalledWith("user-1", { id: "admin-1" }, {});
    expect(result.status).toBe("success");
    expect(result.message).toContain("2026-JD-001");
  });

  it("passes a failure through as an error", async () => {
    mocks.requireAdministrator.mockResolvedValue({ id: "admin-1" });
    mocks.resendCredentials.mockResolvedValue({ ok: false, error: "Credentials cannot be sent to a Deleted User." });

    expect(await resendCredentialsAction("user-1")).toEqual({
      status: "error",
      message: "Credentials cannot be sent to a Deleted User.",
    });
  });
});
