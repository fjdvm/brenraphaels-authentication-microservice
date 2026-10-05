import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  getPortalUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { systemLogEvent: { create: mocks.create, findMany: mocks.findMany } },
}));

vi.mock("@/lib/auth/session", () => ({ getPortalUser: mocks.getPortalUser }));

import { listSystemLogEvents, recordSystemLogEvent } from "./system-log";

describe("recordSystemLogEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it("persists actor, action, target and outcome", async () => {
    await recordSystemLogEvent({
      actorId: "u1",
      action: "auth.login",
      targetUserId: "u1",
      outcome: "SUCCESS",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        actorId: "u1",
        action: "auth.login",
        targetUserId: "u1",
        outcome: "SUCCESS",
        detail: null,
      },
    });
  });

  it("records no actor when none is given", async () => {
    await recordSystemLogEvent({ action: "auth.login", outcome: "FAILURE" });

    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      actorId: null,
      targetUserId: null,
      outcome: "FAILURE",
    });
  });

  it("redacts credential-looking material from detail", async () => {
    await recordSystemLogEvent({
      action: "auth.password_reset",
      outcome: "FAILURE",
      detail: "bad token=abc123 and password: hunter2 Bearer eyJhbGciOi.x.y",
    });

    const { detail } = mocks.create.mock.calls[0][0].data;
    expect(detail).not.toMatch(/abc123|hunter2|eyJhbGciOi/);
  });

  it("never lets an audit write failure break the caller", async () => {
    mocks.create.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordSystemLogEvent({ action: "auth.logout", outcome: "SUCCESS" }),
    ).resolves.toBeUndefined();
  });
});

describe("listSystemLogEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "e1",
        occurredAt: new Date("2026-10-06T01:00:00Z"),
        action: "auth.login",
        outcome: "SUCCESS",
        detail: null,
        actor: { username: "2026-ADMIN-001", firstName: "Ada", lastName: "Min" },
        targetUser: { username: "2026-ADMIN-001", firstName: "Ada", lastName: "Min" },
      },
      {
        id: "e2",
        occurredAt: new Date("2026-10-06T00:00:00Z"),
        action: "auth.login",
        outcome: "FAILURE",
        detail: "Unknown Username",
        actor: null,
        targetUser: null,
      },
    ]);
  });

  it("returns newest events with actor and target when known", async () => {
    mocks.getPortalUser.mockResolvedValue({ id: "a", isAdministrator: true });

    const events = await listSystemLogEvents();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { occurredAt: "desc" } }),
    );
    expect(events[0]).toMatchObject({
      id: "e1",
      action: "Signed in",
      outcome: "SUCCESS",
      actor: "Ada Min (2026-ADMIN-001)",
      target: "Ada Min (2026-ADMIN-001)",
    });
    expect(events[1]).toMatchObject({ outcome: "FAILURE", actor: null, target: null });
  });

  it.each([
    ["signed out", null],
    ["not an Administrator (or demoted)", { id: "u", isAdministrator: false }],
  ])("rejects reads when %s", async (_label, user) => {
    mocks.getPortalUser.mockResolvedValue(user);

    await expect(listSystemLogEvents()).rejects.toThrow("Administrators only");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
