-- Rename SCMS to IMS in place so the System keeps its id, Modules and AccessGrant
-- history. Guarded so a database that already has an IMS System is left untouched,
-- and so re-running cannot create a second System.
UPDATE "System"
SET "name" = 'IMS',
    "url" = CASE
      WHEN "url" = 'https://br-scms.jude-nitram08.workers.dev' THEN 'https://br-ims.jude-nitram08.workers.dev'
      ELSE "url"
    END
WHERE "name" = 'SCMS'
  AND NOT EXISTS (SELECT 1 FROM "System" WHERE "name" = 'IMS');

-- The SCMS Manager Role is renamed the same way, preserving its id and assignments.
UPDATE "Role"
SET "name" = 'IMS Manager'
WHERE "name" = 'SCMS Manager'
  AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'IMS Manager');
