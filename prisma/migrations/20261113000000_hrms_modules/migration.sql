BEGIN;

-- Apply after the Portal legacy hiring bridge is deployed (fjdvm/hrms#316).
-- Retired Modules remain addressable by historical AccessGrants.
INSERT INTO "Module" (id, "systemId", name)
SELECT gen_random_uuid()::text, s.id, names.name
FROM "System" s CROSS JOIN (VALUES
  ('Dashboard'), ('Job Postings'), ('Applications'), ('Interviews'), ('Offers'),
  ('Employee Information'), ('Employee Onboarding'), ('Training'), ('Performance')
) AS names(name)
WHERE s.name = 'HRMS'
ON CONFLICT ("systemId", name) DO NOTHING;

-- Only live Recruitment and Hiring grants carry forward. Existing destination
-- grants win; revoked history is never reactivated. Preserve the granting actor.
INSERT INTO "AccessGrant" (id, "userId", "moduleId", "grantedBy")
SELECT gen_random_uuid()::text, g."userId", destination.id, g."grantedBy"
FROM "AccessGrant" g
JOIN "Module" source ON source.id = g."moduleId"
JOIN "System" s ON s.id = source."systemId"
JOIN "Module" destination ON destination."systemId" = s.id
  AND destination.name IN ('Job Postings', 'Applications', 'Interviews', 'Offers')
WHERE s.name = 'HRMS' AND source.name = 'Recruitment and Hiring'
  AND g."revokedAt" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AccessTemplate" (id, "roleId", "moduleId")
SELECT gen_random_uuid()::text, t."roleId", destination.id
FROM "AccessTemplate" t
JOIN "Module" source ON source.id = t."moduleId"
JOIN "System" s ON s.id = source."systemId"
JOIN "Module" destination ON destination."systemId" = s.id
  AND destination.name IN ('Job Postings', 'Applications', 'Interviews', 'Offers')
WHERE s.name = 'HRMS' AND source.name = 'Recruitment and Hiring'
ON CONFLICT ("roleId", "moduleId") DO NOTHING;

UPDATE "Module" m SET "retiredAt" = CURRENT_TIMESTAMP
FROM "System" s WHERE m."systemId" = s.id AND s.name = 'HRMS'
AND m.name NOT IN ('Dashboard', 'Job Postings', 'Applications', 'Interviews', 'Offers',
  'Employee Information', 'Employee Onboarding', 'Training', 'Performance');

UPDATE "AccessGrant" g SET "revokedAt" = CURRENT_TIMESTAMP
FROM "Module" m WHERE g."moduleId" = m.id AND m."retiredAt" IS NOT NULL
  AND g."revokedAt" IS NULL;

DELETE FROM "AccessTemplate" t USING "Module" m
WHERE t."moduleId" = m.id AND m."retiredAt" IS NOT NULL;

UPDATE "System" SET description = 'Recruitment, employee records, onboarding, training and performance.' WHERE name = 'HRMS';
COMMIT;
