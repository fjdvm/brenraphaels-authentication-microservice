BEGIN;

-- CREOMS Ticket reports open under their own Module (fjdvm/epic-crms#389): Manager, Admin and CEO, never Staff.
INSERT INTO "Module" (id, "systemId", name)
SELECT gen_random_uuid()::text, s.id, 'Reports'
FROM "System" s WHERE s.name = 'CRMS'
ON CONFLICT ("systemId", name) DO NOTHING;

-- Everyone who already holds Fulfilment (whose reports this page sits beside) keeps report access, except Staff.
-- Revoked history is never reactivated.
INSERT INTO "AccessGrant" (id, "userId", "moduleId", "grantedBy")
SELECT gen_random_uuid()::text, g."userId", destination.id, g."grantedBy"
FROM "AccessGrant" g
JOIN "User" u ON u.id = g."userId"
JOIN "Role" r ON r.id = u."roleId"
JOIN "Module" source ON source.id = g."moduleId" AND source.name = 'Fulfilment'
JOIN "System" s ON s.id = source."systemId" AND s.name = 'CRMS'
JOIN "Module" destination ON destination."systemId" = s.id AND destination.name = 'Reports'
WHERE g."revokedAt" IS NULL AND r.name NOT IN ('Staff/Employee', 'Staff / Employee')
ON CONFLICT DO NOTHING;

-- Role templates are defaults for the Admin's editable checkboxes, never authority or grants.
INSERT INTO "AccessTemplate" (id, "roleId", "moduleId")
SELECT 'creoms-reports-default-' || md5(r.id || ':' || m.id), r.id, m.id
FROM "Role" r CROSS JOIN "Module" m JOIN "System" s ON s.id = m."systemId"
WHERE s.name = 'CRMS' AND m.name = 'Reports' AND m."retiredAt" IS NULL
  AND r.name IN ('Super Admin', 'Admin', 'CEO', 'CRMS Manager', 'CREOMS Manager')
ON CONFLICT ("roleId", "moduleId") DO NOTHING;

COMMIT;
