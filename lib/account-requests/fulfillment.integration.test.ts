import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createFromRequest } from "./fulfillment";

vi.mock("server-only", () => ({}));
vi.mock("./delivery.server", () => ({ startDelivery: () => {} }));
const testUrl = process.env.SEED_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("request fulfillment against migrated Postgres and fake identity/email services", () => {
  async function setup() {
    process.env.DATABASE_URL = testUrl;
    const { prisma } = await import("@/lib/db/prisma");
    const { createFulfillmentPorts } = await import("./fulfillment.server");
    const tag = randomUUID();
    const role = await prisma.role.findFirstOrThrow();
    const admin = await prisma.user.findFirstOrThrow({ where: { role: { isAdministrator: true } } });
    const system = await prisma.system.findUniqueOrThrow({ where: { name: "HRMS" } });
    const modules = await prisma.module.findMany({ where: { retiredAt: null }, take: 2 });
    const request = await prisma.accountRequest.create({ data: {
      reference: `TEST-${tag}`, sourceSystemId: system.id, personName: "Ada Santos", workEmail: `${tag}@example.test`, personalEmail: `${tag}@personal.test`, position: "Staff", branch: "Main", startDate: new Date("2026-12-01"), neededFrom: new Date("2026-11-30"), requesterName: "HR Manager", roleId: role.id, moduleIds: modules.map(m => m.id),
    } });
    const sent: string[] = [];
    const ports = createFulfillmentPorts(request.id, admin);
    ports.provisioning.identity = { create: async () => ({ id: randomUUID() }), remove: async () => {} };
    ports.provisioning.audit = async () => {};
    ports.provisioning.mailer = { sendCredentials: async message => { sent.push(message.to); } };
    return { prisma, request, admin, ports, sent, input: { firstName: "Ada", lastName: "Santos", email: request.workEmail, roleId: role.id, moduleIds: modules.map(m => m.id) } };
  }
  afterAll(async () => { const { prisma } = await import("@/lib/db/prisma"); await prisma.$disconnect(); });

  it("marks opening Seen once and persists its HRMS event with actor and occurrence time", async () => {
    const { prisma, request, admin } = await setup();
    const { markRequestSeen } = await import("./fulfillment.server");
    await Promise.all([markRequestSeen(request.id, admin.id), markRequestSeen(request.id, admin.id)]);
    const saved = await prisma.accountRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(saved.status).toBe("seen");
    const events = await prisma.accountRequestDelivery.findMany({ where: { requestId: request.id } });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ reference: request.reference, status: "seen", actor: admin.id, occurredAt: expect.any(String) });
  }, 30000);

  it("commits one User with grants and durable Created/Login sent events, refusing repeat creation", async () => {
    const { prisma, request, admin, ports, sent, input } = await setup();
    const results = await Promise.all([createFromRequest(request.id, input, admin, ports), createFromRequest(request.id, input, admin, ports)]);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    const saved = await prisma.accountRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(saved.status).toBe("created");
    expect(saved.loginSentAt).not.toBeNull();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: saved.createdUserId! }, include: { accessGrants: true } });
    expect(user.roleId).toBe(input.roleId);
    expect(user.accessGrants.map(g => g.moduleId).sort()).toEqual(input.moduleIds.sort());
    expect(user.username).toMatch(/^2026-AS-\d+$/);
    expect(sent).toEqual([request.workEmail, request.personalEmail]);
    expect((await prisma.accountRequestDelivery.findMany({ where: { requestId: request.id }, orderBy: { createdAt: "asc" } })).map(d => d.status)).toEqual(["account_created", "login_sent"]);
  }, 30000);

  it("refuses a resend while the initial credentials are still being delivered", async () => {
    const { request, admin, ports, input } = await setup();
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    ports.provisioning.mailer = { sendCredentials: async () => { started(); await pending; } };
    const initial = createFromRequest(request.id, input, admin, ports);
    await entered;
    const { resendRequestLogin } = await import("./fulfillment.server");
    try {
      const resent = await resendRequestLogin(request.id, admin);
      expect(resent).toEqual({ ok: false, error: expect.stringContaining("being sent") });
    } finally { release(); }
    expect((await initial).ok).toBe(true);
  }, 30000);

  it("keeps the created account on personal-email failure and does not publish login_sent", async () => {
    const { prisma, request, admin, ports, input } = await setup();
    ports.provisioning.mailer = { sendCredentials: async message => { if (message.to === request.personalEmail) throw new Error("SMTP unavailable"); } };
    const result = await createFromRequest(request.id, input, admin, ports);
    expect(result.ok).toBe(false);
    const saved = await prisma.accountRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(saved.status).toBe("created");
    expect(saved.createdUserId).not.toBeNull();
    expect(saved.loginSentAt).toBeNull();
    expect((await prisma.accountRequestDelivery.findMany({ where: { requestId: request.id } })).map(d => d.status)).toEqual(["account_created"]);
  }, 30000);
});
