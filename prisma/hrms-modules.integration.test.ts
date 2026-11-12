import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("migrates HRMS grants and Role templates without losing history or granting Onboarding", async () => {
  const db = new PGlite();
  try {
    for (const path of ["20261003000000_init", "20261003010000_unique_active_access_grant"]) {
      await db.exec(readFileSync(`prisma/migrations/${path}/migration.sql`, "utf8"));
    }
    await db.exec(`
      INSERT INTO "System" (id, name, url) VALUES ('hrms', 'HRMS', 'https://hrms.test'), ('pos', 'POS', 'https://pos.test');
      INSERT INTO "Role" (id, name) VALUES ('recruiter', 'Recruiter'), ('hr', 'HR'), ('payroll', 'Payroll');
      INSERT INTO "User" (id, username, email, "firstName", "lastName", "roleId", "neonAuthUserId")
        SELECT id, id, id || '@example.test', id, 'Test', id, id FROM "Role";
      INSERT INTO "Module" (id, "systemId", name) VALUES
        ('recruitment', 'hrms', 'Recruitment and Hiring'), ('info', 'hrms', 'Employee Information'),
        ('pay', 'hrms', 'Payroll & ESS'), ('attendance', 'hrms', 'Attendance'),
        ('users', 'hrms', 'User Management'), ('dashboard', 'hrms', 'Dashboard'),
        ('pos-pay', 'pos', 'Payroll & ESS'), ('job', 'hrms', 'Job Postings');
      INSERT INTO "AccessGrant" (id, "userId", "moduleId", "grantedBy") VALUES
        ('recruiter-grant', 'recruiter', 'recruitment', 'hr'), ('hr-grant', 'hr', 'info', 'hr'),
        ('payroll-grant', 'payroll', 'pay', 'hr'), ('existing-job', 'recruiter', 'job', 'hr'),
        ('pos-grant', 'payroll', 'pos-pay', 'hr');
      INSERT INTO "AccessGrant" (id, "userId", "moduleId", "revokedAt") VALUES
        ('revoked-recruitment', 'hr', 'recruitment', '2026-01-01');
      INSERT INTO "AccessTemplate" (id, "roleId", "moduleId") VALUES
        ('rt', 'recruiter', 'recruitment'), ('ht', 'hr', 'info'), ('pt', 'payroll', 'pay');
    `);
    const active = async () => (await db.query(`SELECT g."userId", m.name FROM "AccessGrant" g
      JOIN "Module" m ON m.id = g."moduleId" WHERE g."revokedAt" IS NULL ORDER BY 1, 2`)).rows;
    const infoBefore = (await db.query(`SELECT * FROM "AccessGrant" WHERE id = 'hr-grant'`)).rows;
    expect(await active()).toEqual([
      { userId: 'hr', name: 'Employee Information' },
      { userId: 'payroll', name: 'Payroll & ESS' }, { userId: 'payroll', name: 'Payroll & ESS' },
      { userId: 'recruiter', name: 'Job Postings' }, { userId: 'recruiter', name: 'Recruitment and Hiring' },
    ]);
    await db.exec(readFileSync("prisma/migrations/20261113000000_hrms_modules/migration.sql", "utf8"));
    expect(await active()).toEqual([
      { userId: 'hr', name: 'Employee Information' }, { userId: 'payroll', name: 'Payroll & ESS' },
      { userId: 'recruiter', name: 'Applications' }, { userId: 'recruiter', name: 'Interviews' },
      { userId: 'recruiter', name: 'Job Postings' }, { userId: 'recruiter', name: 'Offers' },
    ]);
    expect((await db.query(`SELECT name FROM "Module" WHERE "systemId" = 'hrms' AND "retiredAt" IS NULL ORDER BY name`)).rows)
      .toEqual(['Applications', 'Dashboard', 'Employee Information', 'Employee Onboarding', 'Interviews', 'Job Postings', 'Offers', 'Performance', 'Training'].map(name => ({ name })));
    expect((await db.query(`SELECT * FROM "AccessGrant" WHERE id = 'hr-grant'`)).rows).toEqual(infoBefore);
    expect((await db.query(`SELECT id FROM "AccessGrant" WHERE id IN ('recruiter-grant', 'payroll-grant', 'revoked-recruitment') AND "revokedAt" IS NOT NULL ORDER BY id`)).rows)
      .toEqual([{ id: 'payroll-grant' }, { id: 'recruiter-grant' }, { id: 'revoked-recruitment' }]);
    expect((await db.query(`SELECT t."roleId", m.name FROM "AccessTemplate" t JOIN "Module" m ON m.id = t."moduleId" ORDER BY 1, 2`)).rows)
      .toEqual([{ roleId: 'hr', name: 'Employee Information' }, ...['Applications', 'Interviews', 'Job Postings', 'Offers'].map(name => ({ roleId: 'recruiter', name }))]);
    expect((await db.query(`SELECT DISTINCT "grantedBy" FROM "AccessGrant" WHERE "userId" = 'recruiter' AND "revokedAt" IS NULL`)).rows).toEqual([{ grantedBy: 'hr' }]);
  } finally { await db.close(); }
}, 30_000);
