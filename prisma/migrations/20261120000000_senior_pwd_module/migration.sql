BEGIN;

-- CREOMS reviews Senior/PWD IDs under its own Module (fjdvm/epic-crms#379). Until now the screen used Orders.
INSERT INTO "Module" (id, "systemId", name)
SELECT gen_random_uuid()::text, s.id, 'Senior/PWD'
FROM "System" s WHERE s.name = 'CRMS'
ON CONFLICT ("systemId", name) DO NOTHING;

-- Everyone who can open Orders keeps the review screen. Revoked history is never reactivated.
INSERT INTO "AccessGrant" (id, "userId", "moduleId", "grantedBy")
SELECT gen_random_uuid()::text, g."userId", destination.id, g."grantedBy"
FROM "AccessGrant" g
JOIN "Module" source ON source.id = g."moduleId" AND source.name = 'Orders'
JOIN "System" s ON s.id = source."systemId" AND s.name = 'CRMS'
JOIN "Module" destination ON destination."systemId" = s.id AND destination.name = 'Senior/PWD'
WHERE g."revokedAt" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AccessTemplate" (id, "roleId", "moduleId")
SELECT gen_random_uuid()::text, t."roleId", destination.id
FROM "AccessTemplate" t
JOIN "Module" source ON source.id = t."moduleId" AND source.name = 'Orders'
JOIN "System" s ON s.id = source."systemId" AND s.name = 'CRMS'
JOIN "Module" destination ON destination."systemId" = s.id AND destination.name = 'Senior/PWD'
ON CONFLICT ("roleId", "moduleId") DO NOTHING;

COMMIT;
