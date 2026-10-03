-- A User may have multiple historical (revoked) AccessGrants for a Module,
-- but never more than one active grant.
CREATE UNIQUE INDEX "AccessGrant_one_active_per_user_module"
ON "AccessGrant"("userId", "moduleId")
WHERE "revokedAt" IS NULL;
