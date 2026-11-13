import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createAccountRequestStore } from "./store";
import { handleAccountRequest, handleAccountRequestOptions, handleAccountRequestAction } from "./endpoints";
import { declineAccountRequest, createDeclineStore } from "./decline";
import { hashToken } from "../integrations/tokens";
import { stubNotificationsService } from "../notifications/test-support";

const db = new PGlite();
const notifications = stubNotificationsService();
const store = createAccountRequestStore({
  async query<T>(sql: import("@prisma/client").Prisma.Sql): Promise<T[]> {
    return (await db.query<T>(sql.text, [...sql.values])).rows;
  },
});
const ports = { ...store, notify: notifications.notify };
const payload = {
  reference: "RQ-0001", employee: { name: "Ada Santos", workEmail: "ada@brenraphaels.ph", personalEmail: "ada@example.com", mobile: "09171234567", position: "Staff", branch: "Main", startDate: "2026-12-01" },
  roleId: "staff", moduleIds: ["info", "orders"], neededFrom: "2026-11-30", note: "Early access", requestedBy: { name: "HR Manager" },
};
const request = (body = payload, secret = "secret") => new Request("https://portal.test/api/integrations/account-requests", {
  method: "POST", headers: { authorization: `Basic ${Buffer.from(`HRMS:${secret}`).toString("base64")}` }, body: JSON.stringify(body),
});
beforeAll(async () => {
  for (const migration of ["20261003000000_init", "20261005000000_administrator_role_authority", "20261007000000_system_handoff", "20261112000000_module_retirement", "20261114000000_account_requests", "20261115000000_account_request_fulfillment", "20261116000000_account_request_decline"]) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
  await db.query(`INSERT INTO "System" (id,name,url,"backendSecretHash") VALUES ('hrms','HRMS','https://hrms.test',$1),('crms','CRMS','https://crms.test',NULL)`, [hashToken("secret")]);
  await db.exec(`
    INSERT INTO "Role" (id,name,"isAdministrator") VALUES ('staff','Staff',false),('admin','Super Admin',true),('ceo','CEO',true);
    INSERT INTO "User" (id,username,email,"firstName","lastName","roleId","neonAuthUserId","mustChangePassword") VALUES
      ('admin','admin','admin@example.com','Admin','Test','admin','auth-admin',false),
      ('ceo','ceo','ceo@example.com','CEO','Test','ceo','auth-ceo',false),
      ('staff','staff','TAKEN@example.com','Staff','Test','staff','auth-staff',false);
    INSERT INTO "Module" (id,"systemId",name,"retiredAt") VALUES ('info','hrms','Employee Information',NULL),('orders','crms','Orders',NULL),('old','hrms','Old',now());
    INSERT INTO "AccessTemplate" (id,"roleId","moduleId") VALUES ('t1','staff','info'),('t2','staff','old');
  `);
}, 30000);
afterAll(async () => { await db.close(); });

it("receives and persists the request idempotently across deliveries, notifying only Administrators", async () => {
  expect((await handleAccountRequest(request(payload, "bad"), ports)).status).toBe(401);
  const responses = await Promise.all(Array.from({ length: 4 }, () => handleAccountRequest(request(), ports)));
  expect(responses.map(r => r.status).sort()).toEqual([200,200,200,201]);
  for (const response of responses) expect(await response.json()).toEqual({ reference: "RQ-0001", status: "new" });
  expect(notifications.sent.map(n => n.userIds).sort()).toEqual([["admin"],["ceo"]]);
  // Migration and persisted person fields are part of this endpoint's durable contract.
  const rows = (await db.query(`SELECT "sourceSystemId", "personName", "workEmail", "personalEmail", mobile, "roleId", "moduleIds", "neededFrom"::text, note, "requesterName", status FROM "AccountRequest"`)).rows;
  expect(rows).toEqual([{ sourceSystemId: "hrms", personName: "Ada Santos", workEmail: "ada@brenraphaels.ph", personalEmail: "ada@example.com", mobile: "09171234567", roleId: "staff", moduleIds: ["info","orders"], neededFrom: "2026-11-30", note: "Early access", requesterName: "HR Manager", status: "new" }]);
});

it("refuses a case-insensitive User email collision, including Deleted Users", async () => {
  for (const isDeleted of [false, true]) {
    await db.query(`UPDATE "User" SET "isDeleted" = $1 WHERE id = 'staff'`, [isDeleted]);
    const response = await handleAccountRequest(request({ ...payload, reference: "RQ-0002", employee: { ...payload.employee, workEmail: "Taken@Example.com" } }), ports);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "email-taken" });
  }
});

it("allows only one concurrent active request per work email", async () => {
  const responses = await Promise.all(["RQ-0003", "RQ-0004"].map(reference => handleAccountRequest(request({ ...payload, reference, employee: { ...payload.employee, workEmail: "concurrent@example.com" } }), ports)));
  expect(responses.map(r => r.status).sort()).toEqual([201,409]);
});

it("serves only current Modules and current Role templates across Systems", async () => {
  expect((await handleAccountRequestOptions(request(payload, "bad"), ports)).status).toBe(401);
  const response = await handleAccountRequestOptions(request(), ports);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    roles: [{ id: "ceo", name: "CEO", moduleIds: [] }, { id: "staff", name: "Staff", moduleIds: ["info"] }, { id: "admin", name: "Super Admin", moduleIds: [] }],
    systems: [{ id: "crms", name: "CRMS", modules: [{ id: "orders", name: "Orders" }] }, { id: "hrms", name: "HRMS", modules: [{ id: "info", name: "Employee Information" }] }],
  });
});

it("accepts an empty Module selection and acknowledges retries after account creation", async () => {
  const body = { ...payload, reference: "RQ-0005", moduleIds: [], employee: { ...payload.employee, workEmail: "no-modules@example.com" } };
  expect((await handleAccountRequest(request(body), ports)).status).toBe(201);
  await db.exec(`INSERT INTO "User" (id,username,email,"firstName","lastName","roleId","neonAuthUserId") VALUES ('created','created','no-modules@example.com','Created','Test','staff','auth-created');
    UPDATE "AccountRequest" SET status = 'created' WHERE reference = 'RQ-0005';`);
  const response = await handleAccountRequest(request(body), ports);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ reference: "RQ-0005", status: "created" });
});


it("reminds Administrators and cancels an open request idempotently", async () => {
  const body = { ...payload, reference: "RQ-0343", employee: { ...payload.employee, workEmail: "remind@example.com" } };
  expect((await handleAccountRequest(request(body), ports)).status).toBe(201);
  const before = notifications.sent.length;
  expect((await handleAccountRequestAction(request(), "RQ-0343", "remind", ports)).status).toBe(200);
  expect(notifications.sent.slice(before).map(n => n.userIds).sort()).toEqual([["admin"], ["ceo"]]);
  for (let i = 0; i < 2; i++) {
    const response = await handleAccountRequestAction(request(), "RQ-0343", "cancel", ports);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "cancelled" });
  }
  const reminder = await handleAccountRequestAction(request(), "RQ-0343", "remind", ports);
  expect(reminder.status).toBe(409);
  expect(await reminder.json()).toEqual({ status: "cancelled" });
});

it("authenticates actions, scopes references to HRMS, and refuses terminal requests", async () => {
  for (const action of ["remind", "cancel"] as const) {
    expect((await handleAccountRequestAction(request(payload, "bad"), "RQ-0001", action, ports)).status).toBe(401);
    expect((await handleAccountRequestAction(request(), "invalid", action, ports)).status).toBe(400);
    expect((await handleAccountRequestAction(request(), "RQ-9999", action, ports)).status).toBe(404);
    const before = notifications.sent.length;
    const created = await handleAccountRequestAction(request(), "RQ-0005", action, ports);
    expect(created.status).toBe(409);
    expect(await created.json()).toEqual({ status: "account_created" });
    expect(notifications.sent.length).toBe(before);
  }
  await db.exec(`UPDATE "AccountRequest" SET status = 'seen' WHERE reference = 'RQ-0001'`);
  expect((await handleAccountRequestAction(request(), "RQ-0001", "cancel", ports)).status).toBe(200);
  const rows = await db.query<{ id: string }>(`SELECT id FROM "AccountRequest" WHERE reference = 'RQ-0001'`);
  const declinedAfterCancel = await declineAccountRequest(rows.rows[0].id, { reason: "Other" }, { id: "admin" }, {
    decline: createDeclineStore({ async query<T>(sql: import("@prisma/client").Prisma.Sql): Promise<T[]> {
      return (await db.query<T>(sql.text, [...sql.values])).rows;
    } }),
    startDelivery() { throw new Error("Cancelled requests must not emit decline events"); },
    async audit() { throw new Error("Cancelled requests must not record a decline"); },
  });
  expect(declinedAfterCancel.ok).toBe(false);
  await db.exec(`UPDATE "AccountRequest" SET status = 'declined' WHERE reference = 'RQ-0005'`);
  const declined = await handleAccountRequestAction(request(), "RQ-0005", "cancel", ports);
  expect(declined.status).toBe(409);
  expect(await declined.json()).toEqual({ status: "declined" });
});


it("returns login_sent as the current status once login delivery is confirmed", async () => {
  await db.exec(`UPDATE "AccountRequest" SET status = 'created', "loginSentAt" = now() WHERE reference = 'RQ-0005'`);
  for (const action of ["remind", "cancel"] as const) {
    const response = await handleAccountRequestAction(request(), "RQ-0005", action, ports);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ status: "login_sent" });
  }
});
