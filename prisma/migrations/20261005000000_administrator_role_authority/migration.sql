ALTER TABLE "Role" RENAME COLUMN "isSuperAdmin" TO "isAdministrator";

UPDATE "Role"
SET "isAdministrator" = true
WHERE "name" IN ('Super Admin', 'CEO');
