import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { accountRequest: { findUnique: mocks.findUnique } } }));
const session = vi.hoisted(() => ({ requireAdministrator: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/actions/account-requests", () => ({}));
vi.mock("@/actions/users", () => ({}));
vi.mock("@/components/admin/create-user-form", () => ({}));
vi.mock("@/components/admin/page-headings", () => ({ NewUserHeading: () => null }));
vi.mock("@/lib/admin/user-form-options", () => ({}));
import NewUserPage from "./page";

beforeEach(() => {
  mocks.findUnique.mockClear();
  session.requireAdministrator.mockResolvedValue({ roleName: "Admin" });
});

it("opens the request's recovery panel when account creation already committed", async () => {
  mocks.findUnique.mockResolvedValue({ id: "request-1", status: "created" });
  await expect(NewUserPage({ searchParams: Promise.resolve({ request: "request-1" }) })).rejects.toThrow("redirect:/admin/account-requests?request=request-1");
});

it("shows a CEO no form for creating a User, and never reads the request", async () => {
  session.requireAdministrator.mockResolvedValue({ roleName: "CEO" });
  const page = await NewUserPage({ searchParams: Promise.resolve({ request: "request-1" }) });
  expect(JSON.stringify(page)).toContain("Only an Admin can add users.");
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
