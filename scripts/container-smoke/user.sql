INSERT INTO "Role" (id, name, "isAdministrator") VALUES ('smoke-role', 'Smoke Staff', false);
INSERT INTO "User" (id, username, email, "firstName", "lastName", "roleId", "neonAuthUserId", "mustChangePassword", "isDeleted")
VALUES ('smoke-user', 'SMOKE-142', 'smoke@example.test', 'Smoke Staff', 'User', 'smoke-role', 'smoke-auth-user', false, false);
