export type StatusDelivery = { id: string; payload: unknown };
export type DeliveryPorts = {
  send(payload: unknown): Promise<{ ok: boolean }>;
  acknowledge(id: string): Promise<void>;
  later(run: () => Promise<void>, delay: number): void;
};

/** Retries one known unacknowledged push; never refetches application data on a timer. */
export async function deliverStatus(delivery: StatusDelivery, ports: DeliveryPorts, attempt = 0): Promise<void> {
  try {
    const response = await ports.send(delivery.payload);
    if (!response.ok) throw new Error("Webhook not acknowledged");
    await ports.acknowledge(delivery.id);
  } catch {
    const delay = Math.min(300_000, 1000 * 2 ** Math.min(attempt, 9));
    ports.later(() => deliverStatus(delivery, ports, attempt + 1), delay);
  }
}
