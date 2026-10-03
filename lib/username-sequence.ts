import type { Prisma } from "@prisma/client";

type UsernameSequenceTransaction = Prisma.TransactionClient;

export function usernameYear(date: Date = new Date()): number {
  return date.getUTCFullYear();
}

/**
 * Atomically advances a year's Username sequence within the supplied
 * transaction. If its caller rolls back, the increment rolls back too.
 */
export async function incrementUsernameSequence(
  transaction: UsernameSequenceTransaction,
  year: number,
): Promise<number> {
  const [sequence] = await transaction.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "UsernameSequence" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
    SET "lastNumber" = "UsernameSequence"."lastNumber" + 1
    RETURNING "lastNumber"
  `;

  return sequence.lastNumber;
}
