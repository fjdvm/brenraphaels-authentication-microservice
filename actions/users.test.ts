import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator, apply } = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdministrator }));
vi.mock("@/lib/admin/credential-resend.server", () => ({ createProductionResendPorts: vi.fn() }));
vi.mock("@/lib/admin/user-provisioning.server", () => ({ createProductionProvisioningPorts: vi.fn() }));
vi.mock("@/lib/admin/user-lifecycle.server", () => ({ createProductionLifecyclePorts: vi.fn() }));
vi.mock("@/lib/admin/user-access.server", () => ({
  createProductionAccessPorts: () => ({
    store: {
      findUser: async () => ({ id: "u-1", roleId: "r-1", isDeleted: false }),
      roleExists: async () => true,
      countModules: async () => 0,
      apply,
    },
    audit: vi.fn(),
  }),
}));

import { updateUserAccessAction } from "./users";

const initial = { error: null, saved: false, fieldErrors: {} };

function form() {
  const data = new FormData();
  data.set("userId", "u-1");
  data.set("roleId", "r-1");
  return data;
}

describe("updateUserAccessAction", () => {
  beforeEach(() => {
    apply.mockReset();
    apply.mockResolvedValue({ roleChange: null, granted: 0, revoked: 0 });
    requireAdministrator.mockReset();
  });

  it("changes nothing when the caller is not a current Administrator", async () => {
    requireAdministrator.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateUserAccessAction(initial, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(apply).not.toHaveBeenCalled();
  });

  it("saves for a current Administrator, attributing the change to them", async () => {
    requireAdministrator.mockResolvedValue({ id: "admin-1" });

    const state = await updateUserAccessAction(initial, form());

    expect(state).toEqual({ error: null, saved: true, fieldErrors: {} });
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", userId: "u-1" }));
  });
});
