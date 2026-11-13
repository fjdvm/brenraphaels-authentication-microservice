import "server-only";
import { prisma } from "@/lib/db/prisma";
import { deliverStatus, type StatusDelivery } from "./delivery";

const active = new Set<string>();

/** Start directly from a committed event, so a failed outbox read cannot strand a new push. */
export function startDelivery(delivery: StatusDelivery) {
  if (active.has(delivery.id)) return;
  active.add(delivery.id);
  void deliverStatus(delivery, {
    async send(payload) {
      const url = process.env.HRMS_ACCOUNT_REQUEST_WEBHOOK_URL;
      const secret = process.env.HRMS_SYSTEM_SECRET;
      if (!url || !secret) throw new Error("HRMS webhook is not configured");
      return fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000), redirect: "error" });
    },
    async acknowledge(id) {
      await prisma.accountRequestDelivery.deleteMany({ where: { id } });
      active.delete(id);
    },
    later(run, delay) { setTimeout(() => { void run(); }, delay).unref(); },
  });
}

/** Startup recovery only; fails initialization on a database outage so the host can restart. */
export async function resumePendingDeliveries() {
  const deliveries = await prisma.accountRequestDelivery.findMany({ orderBy: { createdAt: "asc" } });
  for (const delivery of deliveries) startDelivery(delivery);
}
