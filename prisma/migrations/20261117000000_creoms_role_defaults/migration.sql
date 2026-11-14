-- Role templates are defaults for the Admin's editable checkboxes, never authority or grants.
INSERT INTO "AccessTemplate" (id, "roleId", "moduleId")
SELECT 'creoms-role-default-' || md5(r.id || ':' || m.id), r.id, m.id
FROM "Role" r CROSS JOIN "Module" m JOIN "System" s ON s.id = m."systemId"
WHERE s.name = 'CRMS' AND m."retiredAt" IS NULL AND (
  r.name IN ('Super Admin', 'Admin', 'CEO', 'CRMS Manager', 'CREOMS Manager') OR
  (r.name IN ('Staff/Employee', 'Staff / Employee') AND m.name IN ('Dashboard','Customer Profiles','Orders','Payments','Fulfilment','Returns','Tickets','Feedback'))
)
ON CONFLICT ("roleId", "moduleId") DO NOTHING;
