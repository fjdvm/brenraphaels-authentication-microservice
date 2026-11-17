-- Payment accounts (#297): any number of GCash, Maya and bank accounts, deactivated rather than deleted.
CREATE TYPE "PaymentMethod" AS ENUM ('GCASH', 'MAYA', 'BANK');

CREATE TABLE "PaymentAccount" (
  "id" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAccount_method_active_idx" ON "PaymentAccount"("method", "active");

-- The single set of payment details becomes the first accounts (a blank method had no account).
INSERT INTO "PaymentAccount" ("id", "method", "accountName", "accountNumber", "bankName", "updatedById")
SELECT 'pa_gcash_' || "id", 'GCASH', "gcashName", "gcashNumber", '', "updatedById" FROM "PaymentSettings" WHERE "gcashNumber" <> '';
INSERT INTO "PaymentAccount" ("id", "method", "accountName", "accountNumber", "bankName", "updatedById")
SELECT 'pa_maya_' || "id", 'MAYA', "mayaName", "mayaNumber", '', "updatedById" FROM "PaymentSettings" WHERE "mayaNumber" <> '';
INSERT INTO "PaymentAccount" ("id", "method", "accountName", "accountNumber", "bankName", "updatedById")
SELECT 'pa_bank_' || "id", 'BANK', "bankAccountName", "bankAccountNumber", "bankName", "updatedById" FROM "PaymentSettings" WHERE "bankAccountNumber" <> '';
