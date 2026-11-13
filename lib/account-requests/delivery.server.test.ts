import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { findMany, deleteMany } = vi.hoisted(() => ({ findMany: vi.fn(async () => { throw new Error("outbox read unavailable"); }), deleteMany: vi.fn(async () => ({ count: 1 })) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { accountRequestDelivery: { findMany, deleteMany } } }));
import { startDelivery } from "./delivery.server";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("starts a committed event without reading the outbox and retries a failed push", async () => {
  vi.useFakeTimers();
  vi.stubEnv("HRMS_ACCOUNT_REQUEST_WEBHOOK_URL", "https://hrms.example.test/status");
  vi.stubEnv("HRMS_SYSTEM_SECRET", "system-secret");
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  startDelivery({ id: "committed-event", payload: { reference: "RQ-0001", status: "seen" } });
  await vi.advanceTimersByTimeAsync(1000);
  expect(findMany).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].headers.authorization).toBe("Bearer system-secret");
  expect(deleteMany).toHaveBeenCalledWith({ where: { id: "committed-event" } });
});
