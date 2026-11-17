"use server";

import { declineRequest } from "@/lib/account-requests/decline.server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFullAccess } from "@/lib/auth/session";
import { fulfillAccountRequest, markRequestSeen, resendRequestLogin } from "@/lib/account-requests/fulfillment.server";
import { invalidatePortalReads } from "@/lib/cache/portal-reads";
import type { CreateUserFormState } from "@/lib/admin/user-form-state";

export async function seeAccountRequestAction(id: string) {
  const administrator = await requireFullAccess();
  await markRequestSeen(id, administrator.id);
  revalidatePath("/admin/account-requests");
  invalidatePortalReads();
}

export async function createRequestUserAction(id: string, _previous: CreateUserFormState, form: FormData): Promise<CreateUserFormState> {
  const administrator = await requireFullAccess();
  const text = (key: string) => String(form.get(key) ?? "");
  const result = await fulfillAccountRequest(id, {
    firstName: text("firstName"), lastName: text("lastName"), email: text("email"), roleId: text("roleId"),
    moduleIds: form.getAll("moduleIds").filter((value): value is string => typeof value === "string"),
  }, administrator);
  revalidatePath("/admin/account-requests");
  revalidatePath("/admin/users");
  invalidatePortalReads();
  if (!result.ok) return { error: result.error, fieldErrors: "fieldErrors" in result ? result.fieldErrors ?? {} : {} };
  redirect(`/admin/users?created=${encodeURIComponent(result.user.username)}`);
}

export async function resendRequestLoginAction(id: string) {
  const administrator = await requireFullAccess();
  const result = await resendRequestLogin(id, administrator);
  revalidatePath("/admin/account-requests");
  invalidatePortalReads();
  return result.ok ? { error: null } : { error: result.error };
}

export async function declineAccountRequestAction(id: string, input: { reason: string; message?: string }) {
  const administrator = await requireFullAccess();
  const result = await declineRequest(id, input, administrator);
  if (result.ok) {
    revalidatePath("/admin/account-requests");
    invalidatePortalReads();
  }
  return result.ok ? { error: null } : { error: result.error };
}
