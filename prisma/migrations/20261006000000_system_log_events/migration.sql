CREATE TYPE "SystemLogOutcome" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "SystemLogEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "outcome" "SystemLogOutcome" NOT NULL,
    "detail" TEXT,

    CONSTRAINT "SystemLogEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemLogEvent_occurredAt_idx" ON "SystemLogEvent"("occurredAt");

ALTER TABLE "SystemLogEvent" ADD CONSTRAINT "SystemLogEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SystemLogEvent" ADD CONSTRAINT "SystemLogEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
