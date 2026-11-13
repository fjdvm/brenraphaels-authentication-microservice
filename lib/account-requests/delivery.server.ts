import "server-only";
import { prisma } from "@/lib/db/prisma";
import { deliverStatus } from "./delivery";

const active = new Set<string>();

/** Called on startup and after a mutation. Each pending delivery owns its retry, with no idle polling. */
export async function resumePendingDeliveries() {
  const deliveries = await prisma.accountRequestDelivery.findMany({ orderBy: { createdAt: "asc" } });
  for (const delivery of deliveries) {
    if (active.has(delivery.id)) continue;
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
}

export async function wakeDeliveries() {
  await resumePendingDeliveries().catch(error => {
    console.error("Could not wake HRMS deliveries; persisted events will resume at startup or the next action", error);
  });
}
