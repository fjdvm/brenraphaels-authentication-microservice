import { beforeEach, describe, expect, it, vi } from "vitest";

// A CEO has View access only (ADR-0006): every User write is refused with 403 before any port is touched.
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  provisioning: vi.fn(),
  lifecycle: vi.fn(),
  resend: vi.fn(),
  access: vi.fn(),
  requestWrite: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  forbidden: () => {
    throw new Error("forbidden:403");
  },
}));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: mocks.getSession } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/account-requests/fulfillment.server", () => ({ markRequestSeen: mocks.requestWrite, fulfillAccountRequest: mocks.requestWrite, resendRequestLogin: mocks.requestWrite }));
vi.mock("@/lib/account-requests/decline.server", () => ({ declineRequest: mocks.requestWrite }));
vi.mock("@/lib/cache/portal-reads", () => ({ invalidatePortalReads: vi.fn() }));
vi.mock("@/lib/admin/user-provisioning.server", () => ({ createProductionProvisioningPorts: mocks.provisioning }));
vi.mock("@/lib/admin/user-lifecycle.server", () => ({ createProductionLifecyclePorts: mocks.lifecycle }));
vi.mock("@/lib/admin/credential-resend.server", () => ({ createProductionResendPorts: mocks.resend }));
vi.mock("@/lib/admin/user-access.server", () => ({ createProductionAccessPorts: mocks.access }));

import {
  createUserAction,
  deleteUserAction,
  resendCredentialsAction,
  restoreUserAction,
  updateUserAccessAction,
} from "./users";
import {
  createRequestUserAction,
  declineAccountRequestAction,
  resendRequestLoginAction,
  seeAccountRequestAction,
} from "./account-requests";

function asRole(name: string) {
  mocks.getSession.mockResolvedValue({ data: { user: { id: "neon-1" } } });
  mocks.findUnique.mockResolvedValue({
    id: "u-1",
    username: "2026-CEO-001",
    firstName: "C",
    lastName: "E",
    email: "ceo@example.com",
    mustChangePassword: false,
    isDeleted: false,
    role: { name, isAdministrator: true },
  });
}

const form = () => {
  const data = new FormData();
  data.set("userId", "u-2");
  return data;
};

describe("a CEO is refused every User and Account request write", () => {
  beforeEach(() => vi.clearAllMocks());

  const writes: [string, () => Promise<unknown>][] = [
    ["create a User", () => createUserAction({ error: null, fieldErrors: {} }, form())],
    ["update access", () => updateUserAccessAction({ error: null, saved: false, fieldErrors: {} }, form())],
    ["delete", () => deleteUserAction({ error: null }, form())],
    ["restore", () => restoreUserAction({ error: null }, form())],
    ["resend credentials", () => resendCredentialsAction("u-2")],
    ["mark a request Seen", () => seeAccountRequestAction("r-1")],
    ["create an account from a request", () => createRequestUserAction("r-1", { error: null, fieldErrors: {} }, form())],
    ["resend a request's login details", () => resendRequestLoginAction("r-1")],
    ["decline a request", () => declineAccountRequestAction("r-1", { reason: "Duplicate request" })],
  ];

  it.each(writes)("refuses a CEO who tries to %s with 403", async (_name, write) => {
    asRole("CEO");

    await expect(write()).rejects.toThrow("forbidden:403");
    for (const port of [mocks.provisioning, mocks.lifecycle, mocks.resend, mocks.access, mocks.requestWrite]) {
      expect(port).not.toHaveBeenCalled();
    }
  });
});
