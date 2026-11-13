import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuditEventInput } from "@/lib/audit/events";
import type { StatusDelivery } from "./delivery";

const declineInput = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(250),
  message: z.string().trim().max(5000).optional(),
});
type Decline = z.infer<typeof declineInput>;
type DeclinedDelivery = StatusDelivery & { reference: string };
type DeclinePorts = {
  decline(id: string, input: Decline, actor: string): Promise<DeclinedDelivery | null>;
  startDelivery(delivery: StatusDelivery): void;
  audit(event: AuditEventInput): Promise<void>;
};

export async function declineAccountRequest(id: string, input: unknown, administrator: { id: string }, ports: DeclinePorts) {
  const parsed = declineInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Enter a reason (up to 250 characters) and an optional message (up to 5000 characters)." };
  const delivery = await ports.decline(id, parsed.data, administrator.id);
  if (!delivery) return { ok: false as const, error: "This request is no longer open. Reload to see its status." };
  ports.startDelivery(delivery);
  await ports.audit({ action: "account_request.decline", outcome: "SUCCESS", actorId: administrator.id,
    detail: `Declined Account request ${delivery.reference}. Reason: ${parsed.data.reason}${parsed.data.message ? `. Message: ${parsed.data.message}` : ""}` });
  return { ok: true as const };
}

/** One statement commits both the terminal status and its durable push, locking against creation/cancellation. */
export function createDeclineStore(db: { query<T>(sql: Prisma.Sql): Promise<T[]> }): DeclinePorts["decline"] {
  return async (id, input, actor) => {
    const rows = await db.query<DeclinedDelivery>(Prisma.sql`
      WITH declined AS (
        UPDATE "AccountRequest" SET status = 'declined', "declineReason" = ${input.reason},
          "declineMessage" = ${input.message || null}, "declinedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${id} AND status IN ('new', 'seen')
        RETURNING id, reference, "declinedAt"
      ), delivery AS (
        INSERT INTO "AccountRequestDelivery" (id, "requestId", status, payload)
        SELECT ${randomUUID()}, id, 'declined', jsonb_build_object(
          'reference', reference, 'status', 'declined', 'actor', ${actor}::text,
          'occurredAt', to_char("declinedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'reason', ${input.reason}::text, 'message', ${input.message || null}::text)
        FROM declined RETURNING id, payload
      ) SELECT delivery.id, delivery.payload, declined.reference FROM delivery CROSS JOIN declined`);
    return rows[0] ?? null;
  };
}
