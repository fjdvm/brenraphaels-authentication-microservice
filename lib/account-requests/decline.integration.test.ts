import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { declineAccountRequest, createDeclineStore } from "./decline";

const db = new PGlite();
const pushed: unknown[] = [];
const activity: unknown[] = [];
const ports = {
  decline: createDeclineStore({ async query<T>(sql: import("@prisma/client").Prisma.Sql): Promise<T[]> {
    return (await db.query<T>(sql.text, [...sql.values])).rows;
  } }),
  startDelivery: (delivery: unknown) => { pushed.push(delivery); },
  audit: async (event: unknown) => { activity.push(event); },
};
beforeAll(async () => {
  for (const migration of ["20261003000000_init", "20261005000000_administrator_role_authority", "20261007000000_system_handoff", "20261114000000_account_requests", "20261115000000_account_request_fulfillment", "20261116000000_account_request_decline"]) {
    await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
  await db.exec(`INSERT INTO "System" (id,name,url) VALUES ('hrms','HRMS','https://hrms.test');
    INSERT INTO "Role" (id,name) VALUES ('staff','Staff');`);
}, 30000);
afterAll(() => db.close());
async function request(id: string, status = "new") {
  await db.query(`INSERT INTO "AccountRequest" (id,reference,"sourceSystemId","personName","workEmail","personalEmail",position,branch,"startDate","roleId","moduleIds","neededFrom","requesterName","updatedAt",status)
    VALUES ($1,$1,'hrms','Ada',$1 || '@work.test','ada@personal.test','Staff','Main','2026-12-01','staff','{}','2026-12-01','HR Manager',now(),$2::"AccountRequestStatus")`, [id,status]);
}

it("declines an open request once, retaining the reason/message and queuing the HRMS push and activity", async () => {
  await request("RQ-0001");
  expect(await declineAccountRequest("RQ-0001", { reason: "  Duplicate request  ", message: " Please use RQ-0002. " }, { id: "admin" }, ports)).toEqual({ ok: true });
  expect((await db.query(`SELECT status,"declineReason","declineMessage","declinedAt" IS NOT NULL AS dated FROM "AccountRequest" WHERE id='RQ-0001'`)).rows).toEqual([{ status: "declined", declineReason: "Duplicate request", declineMessage: "Please use RQ-0002.", dated: true }]);
  expect(pushed).toHaveLength(1);
  expect(pushed[0]).toMatchObject({ payload: { reference: "RQ-0001", status: "declined", actor: "admin", reason: "Duplicate request", message: "Please use RQ-0002.", occurredAt: expect.any(String) } });
  expect(activity).toEqual([expect.objectContaining({ action: "account_request.decline", actorId: "admin", outcome: "SUCCESS", detail: expect.stringContaining("RQ-0001") })]);
  expect((await declineAccountRequest("RQ-0001", { reason: "Again" }, { id: "admin" }, ports)).ok).toBe(false);
  expect(pushed).toHaveLength(1);
});

it("requires a nonblank bounded reason and limits the optional message before changing status", async () => {
  await request("RQ-0010");
  for (const input of [{}, { reason: "  " }, { reason: "x".repeat(251) }, { reason: "Other", message: "x".repeat(5001) }, null]) {
    expect((await declineAccountRequest("RQ-0010", input, { id: "admin" }, ports)).ok).toBe(false);
  }
  expect((await db.query(`SELECT status FROM "AccountRequest" WHERE id='RQ-0010'`)).rows).toEqual([{ status: "new" }]);
});

it("declines a Seen request without a message and refuses every terminal status and missing request", async () => {
  await request("RQ-0020", "seen");
  expect((await declineAccountRequest("RQ-0020", { reason: "Access not needed" }, { id: "admin" }, ports)).ok).toBe(true);
  expect((await db.query(`SELECT "declineMessage" FROM "AccountRequest" WHERE id='RQ-0020'`)).rows).toEqual([{ declineMessage: null }]);
  for (const status of ["created", "declined", "cancelled"]) {
    await request(`closed-${status}`, status);
    expect((await declineAccountRequest(`closed-${status}`, { reason: "Other" }, { id: "admin" }, ports)).ok).toBe(false);
  }
  expect((await declineAccountRequest("missing", { reason: "Other" }, { id: "admin" }, ports)).ok).toBe(false);
});

it("allows only one concurrent decline and prevents subsequent account creation", async () => {
  await request("RQ-0030");
  const results = await Promise.all(["First reason", "Second reason"].map(reason => declineAccountRequest("RQ-0030", { reason }, { id: "admin" }, ports)));
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect((await db.query(`UPDATE "AccountRequest" SET status='created' WHERE id='RQ-0030' AND status IN ('new','seen') RETURNING id`)).rows).toEqual([]);
  expect((await db.query(`SELECT status FROM "AccountRequestDelivery" WHERE "requestId"='RQ-0030'`)).rows).toEqual([{ status: "declined" }]);
});

it("rolls back the decline if its durable webhook event cannot be queued", async () => {
  await request("RQ-0040");
  await db.exec(`CREATE FUNCTION reject_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$;
    CREATE TRIGGER reject_delivery BEFORE INSERT ON "AccountRequestDelivery" FOR EACH ROW EXECUTE FUNCTION reject_delivery();`);
  try {
    await expect(declineAccountRequest("RQ-0040", { reason: "Other" }, { id: "admin" }, ports)).rejects.toThrow("outbox unavailable");
    expect((await db.query(`SELECT status FROM "AccountRequest" WHERE id='RQ-0040'`)).rows).toEqual([{ status: "new" }]);
  } finally { await db.exec(`DROP TRIGGER reject_delivery ON "AccountRequestDelivery"; DROP FUNCTION reject_delivery();`); }
});
