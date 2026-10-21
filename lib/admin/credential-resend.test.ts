import { describe, expect, it, vi } from "vitest";

import { resendCredentials, type ResendPorts, type ResendTarget } from "./credential-resend";
import type { CredentialsMailer } from "./user-provisioning";

import type { AuditEventInput } from "@/lib/audit/events";
import { stubNotificationsService } from "@/lib/notifications/test-support";

const ADMIN = { id: "admin-1" };

function createWorld(
  initial: Partial<ResendTarget> = {},
  options: {
    unconfigured?: boolean;
    sendFails?: boolean;
    passwordFails?: boolean;
    flagFails?: boolean;
    notificationsDown?: boolean;
  } = {},
) {
  const user: ResendTarget = {
    id: "user-1",
    username: "2026-JD-001",
    firstName: "Juan",
    email: "juan@example.com",
    neonAuthUserId: "auth-1",
    isDeleted: false,
    mustChangePassword: false,
    ...initial,
  };
  const state = { password: "old-password", mustChangePassword: user.mustChangePassword };
  const sent: Parameters<CredentialsMailer["sendCredentials"]>[0][] = [];
  const events: AuditEventInput[] = [];
  const notifications = stubNotificationsService({ down: options.notificationsDown });

  const ports: ResendPorts = {
    store: {
      async findUser(id) {
        return id === user.id ? user : null;
      },
      async markAwaitingFirstLogin() {
        if (options.flagFails) throw new Error("db down");
        state.mustChangePassword = true;
      },
    },
    credentials: {
      async replacePassword(neonAuthUserId, password) {
        if (options.passwordFails) throw new Error("neon down");
        expect(neonAuthUserId).toBe("auth-1");
        state.password = password;
      },
    },
    mailer: {
      async sendCredentials(message) {
        if (options.sendFails) throw new Error("SMTP unreachable");
        sent.push(message);
      },
    },
    deliveryProblem: () => (options.unconfigured ? "Missing SMTP_HOST" : null),
    audit: async (event) => {
      events.push(event);
    },
    generatePassword: () => "Fresh-Temp-1",
    notify: notifications.notify,
  };

  return { ports, state, sent, events, notifications: notifications.sent };
}

describe("resendCredentials", () => {
  it.each([
    ["Active", false],
    ["Awaiting first login", true],
  ])("issues a fresh Temporary password to an %s User", async (_label, awaiting) => {
    const world = createWorld({ mustChangePassword: awaiting });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result).toEqual({ ok: true, username: "2026-JD-001" });
    expect(world.state.password).toBe("Fresh-Temp-1");
    expect(world.state.mustChangePassword).toBe(true);
    expect(world.sent).toEqual([
      {
        to: "juan@example.com",
        firstName: "Juan",
        username: "2026-JD-001",
        temporaryPassword: "Fresh-Temp-1",
        kind: "resend",
      },
    ]);
    expect(world.events).toEqual([
      expect.objectContaining({
        action: "user.resend_credentials",
        outcome: "SUCCESS",
        actorId: "admin-1",
        targetUserId: "user-1",
      }),
    ]);
  });

  it("never exposes the password in the result or the System Log", async () => {
    const world = createWorld();

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(JSON.stringify(result)).not.toContain("Fresh-Temp-1");
    expect(JSON.stringify(world.events)).not.toContain("Fresh-Temp-1");
  });

  it("refuses a Deleted User and changes nothing", async () => {
    const world = createWorld({ isDeleted: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result.ok).toBe(false);
    expect(world.state.password).toBe("old-password");
    expect(world.sent).toHaveLength(0);
    expect(world.events).toEqual([expect.objectContaining({ outcome: "FAILURE", targetUserId: "user-1" })]);
  });

  it("refuses an unknown User", async () => {
    const world = createWorld();

    const result = await resendCredentials("missing", ADMIN, world.ports);

    expect(result.ok).toBe(false);
    expect(world.sent).toHaveLength(0);
  });

  it("reports an email failure truthfully: password replaced, not delivered, retry possible", async () => {
    const world = createWorld({}, { sendFails: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("could not be emailed") });
    expect(world.state.mustChangePassword).toBe(true);
    expect(world.events).toEqual([
      expect.objectContaining({ action: "user.resend_credentials", outcome: "FAILURE" }),
    ]);
    expect(JSON.stringify(world.events)).not.toContain("Fresh-Temp-1");
  });

  it("reports missing email configuration before touching the password", async () => {
    const world = createWorld({}, { unconfigured: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("not configured") });
    expect(world.state.password).toBe("old-password");
    expect(world.sent).toHaveLength(0);
    expect(world.events).toEqual([expect.objectContaining({ outcome: "FAILURE" })]);
  });

  it("reports a provider failure without claiming anything was sent", async () => {
    const world = createWorld({}, { passwordFails: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("password was not changed") });
    expect(world.sent).toHaveLength(0);
    expect(world.state.password).toBe("old-password");
  });

  it("does not email when the User could not be flagged for a password change", async () => {
    const world = createWorld({}, { flagFails: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result.ok).toBe(false);
    expect(world.sent).toHaveLength(0);
  });

  it("sends the User one notification once their new credentials are emailed", async () => {
    const world = createWorld();

    await resendCredentials("user-1", ADMIN, world.ports);

    expect(world.notifications).toEqual([
      expect.objectContaining({ type: "credentials.resent", userIds: ["user-1"] }),
    ]);
  });

  it("sends nothing when the resend fails", async () => {
    const worlds = [
      createWorld({ isDeleted: true }),
      createWorld({}, { unconfigured: true }),
      createWorld({}, { passwordFails: true }),
      createWorld({}, { sendFails: true }),
    ];
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const world of worlds) await resendCredentials("user-1", ADMIN, world.ports);

    expect(worlds.flatMap((world) => world.notifications)).toEqual([]);
  });

  it("sends nothing when an Administrator resends their own credentials", async () => {
    const world = createWorld();

    const result = await resendCredentials("user-1", { id: "user-1" }, world.ports);

    expect(result).toMatchObject({ ok: true });
    expect(world.notifications).toEqual([]);
  });

  it("still resends when the notifications service is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const world = createWorld({}, { notificationsDown: true });

    const result = await resendCredentials("user-1", ADMIN, world.ports);

    expect(result).toEqual({ ok: true, username: "2026-JD-001" });
    expect(world.sent).toHaveLength(1);
  });
});
