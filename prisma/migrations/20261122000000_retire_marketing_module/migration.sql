BEGIN;

-- CREOMS drops the email marketing module (fjdvm/epic-crms#462, #464). The Module is
-- retired, not deleted, so grant history stays; nothing can select or authorize it again.
UPDATE "Module" m SET "retiredAt" = CURRENT_TIMESTAMP
FROM "System" s WHERE m."systemId" = s.id AND s.name = 'CRMS'
  AND m.name IN ('Marketing', 'Campaigns') AND m."retiredAt" IS NULL;

UPDATE "AccessGrant" g SET "revokedAt" = CURRENT_TIMESTAMP
FROM "Module" m JOIN "System" s ON s.id = m."systemId"
WHERE g."moduleId" = m.id AND s.name = 'CRMS' AND m.name IN ('Marketing', 'Campaigns')
  AND g."revokedAt" IS NULL;

DELETE FROM "AccessTemplate" t USING "Module" m JOIN "System" s ON s.id = m."systemId"
WHERE t."moduleId" = m.id AND s.name = 'CRMS' AND m.name IN ('Marketing', 'Campaigns');

UPDATE "System" SET description = 'Customer profiles, orders, conversations, support tickets and feedback.'
WHERE name = 'CRMS';

COMMIT;
