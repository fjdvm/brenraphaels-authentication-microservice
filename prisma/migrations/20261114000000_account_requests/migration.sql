CREATE TYPE "AccountRequestStatus" AS ENUM ('new', 'seen', 'created', 'declined', 'cancelled');
CREATE TABLE "AccountRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "sourceSystemId" TEXT NOT NULL REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "personName" TEXT NOT NULL,
  "workEmail" TEXT NOT NULL,
  "personalEmail" TEXT NOT NULL,
  "mobile" TEXT,
  "position" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "roleId" TEXT NOT NULL REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "moduleIds" TEXT[] NOT NULL,
  "neededFrom" DATE NOT NULL,
  "note" TEXT,
  "requesterName" TEXT NOT NULL,
  "status" "AccountRequestStatus" NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "seenAt" TIMESTAMP(3),
  "accountCreatedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "AccountRequest_sourceSystemId_reference_key" ON "AccountRequest"("sourceSystemId", "reference");
CREATE INDEX "AccountRequest_status_createdAt_idx" ON "AccountRequest"("status", "createdAt");
CREATE UNIQUE INDEX "AccountRequest_active_email_key" ON "AccountRequest"(lower("workEmail")) WHERE "status" IN ('new', 'seen');
