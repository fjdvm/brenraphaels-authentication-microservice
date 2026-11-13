ALTER TABLE "AccountRequest" ADD COLUMN "createdUserId" TEXT, ADD COLUMN "loginSentAt" TIMESTAMP(3);
CREATE TABLE "AccountRequestDelivery" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "AccountRequest"("id"),
  "status" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("requestId", "status")
);
