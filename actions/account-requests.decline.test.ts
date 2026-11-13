import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdministrator: vi.fn(), declineRequest: vi.fn(), revalidatePath: vi.fn(), invalidatePortalReads: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("@/lib/account-requests/decline.server", () => ({ declineRequest: mocks.declineRequest }));
vi.mock("@/lib/account-requests/fulfillment.server", () => ({}));
vi.mock("@/lib/cache/portal-reads", () => ({ invalidatePortalReads: mocks.invalidatePortalReads }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { declineAccountRequestAction } from "./account-requests";
beforeEach(() => vi.resetAllMocks());
it("refuses a non-Administrator before touching a request", async () => {
  mocks.requireAdministrator.mockRejectedValue(new Error("Unauthorized"));
  await expect(declineAccountRequestAction("request", { reason: "Other" })).rejects.toThrow("Unauthorized");
  expect(mocks.declineRequest).not.toHaveBeenCalled();
});
it("uses the signed-in Administrator and refreshes the request list and badge on success", async () => {
  const administrator = { id: "admin" };
  mocks.requireAdministrator.mockResolvedValue(administrator);
  mocks.declineRequest.mockResolvedValue({ ok: true });
  expect(await declineAccountRequestAction("request", { reason: "Other", message: "Try again later" })).toEqual({ error: null });
  expect(mocks.declineRequest).toHaveBeenCalledWith("request", { reason: "Other", message: "Try again later" }, administrator);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/account-requests");
  expect(mocks.invalidatePortalReads).toHaveBeenCalledOnce();
});
it("returns validation or closed-request failures to the caller", async () => {
  mocks.requireAdministrator.mockResolvedValue({ id: "admin" });
  mocks.declineRequest.mockResolvedValue({ ok: false, error: "This request is no longer open." });
  expect(await declineAccountRequestAction("request", { reason: "Other" })).toEqual({ error: "This request is no longer open." });
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
