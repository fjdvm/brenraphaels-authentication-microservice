BEGIN;

-- CREOMS Payment Management and Delivery Management open under their own Module (fjdvm/epic-crms#577).
-- Only a Manager or the CEO may hold it; the Admin's grant forms refuse any other Role.
INSERT INTO "Module" (id, "systemId", name)
SELECT gen_random_uuid()::text, s.id, 'Management'
FROM "System" s WHERE s.name = 'CRMS'
ON CONFLICT ("systemId", name) DO NOTHING;

-- Role templates are defaults for the Admin's editable checkboxes, never authority or grants.
-- No existing user is granted the Module here; the Admin does that.
INSERT INTO "AccessTemplate" (id, "roleId", "moduleId")
SELECT 'creoms-management-default-' || md5(r.id || ':' || m.id), r.id, m.id
FROM "Role" r CROSS JOIN "Module" m JOIN "System" s ON s.id = m."systemId"
WHERE s.name = 'CRMS' AND m.name = 'Management' AND m."retiredAt" IS NULL
  AND r.name IN ('CEO', 'CRMS Manager', 'CREOMS Manager')
ON CONFLICT ("roleId", "moduleId") DO NOTHING;

COMMIT;
