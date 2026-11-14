-- The four Roles are Staff / Employee, Manager, Admin and CEO. Rename in place, keeping the id so
-- User assignments and access templates carry over. A deployment that already has an Admin Role is left alone.
UPDATE "Role" SET name = 'Admin'
WHERE name = 'Super Admin' AND NOT EXISTS (SELECT 1 FROM "Role" WHERE name = 'Admin');
