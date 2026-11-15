-- The shop's GCash, Maya and bank details (CREOMS #340). One row, edited by an Admin in General settings.
CREATE TABLE "PaymentSettings" (
  "id" TEXT NOT NULL DEFAULT 'shop',
  "gcashNumber" TEXT NOT NULL DEFAULT '',
  "gcashName" TEXT NOT NULL DEFAULT '',
  "mayaNumber" TEXT NOT NULL DEFAULT '',
  "mayaName" TEXT NOT NULL DEFAULT '',
  "bankName" TEXT NOT NULL DEFAULT '',
  "bankAccountName" TEXT NOT NULL DEFAULT '',
  "bankAccountNumber" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);
