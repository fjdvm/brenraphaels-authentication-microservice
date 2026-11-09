-- Add only the new Role and its defaults. Existing Users and other Roles are untouched.
INSERT INTO "Role" ("id", "name", "isAdministrator")
VALUES (gen_random_uuid()::text, 'General Manager', false)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "AccessTemplate" ("id", "roleId", "moduleId")
SELECT gen_random_uuid()::text, r."id", m."id"
FROM "Role" r CROSS JOIN "Module" m
WHERE r."name" = 'General Manager'
ON CONFLICT ("roleId", "moduleId") DO NOTHING;
