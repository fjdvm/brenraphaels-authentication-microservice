"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProductionProvisioningPorts } from "@/lib/admin/user-provisioning.server";
import { createProductionLifecyclePorts } from "@/lib/admin/user-lifecycle.server";
import { changeUserLifecycle, type LifecycleAction } from "@/lib/admin/user-lifecycle";
import { provisionUser } from "@/lib/admin/user-provisioning";
import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import type { CreateUserFormState } from "@/lib/admin/user-form-state";
import { requireAdministrator } from "@/lib/auth/session";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function createUserAction(
  _previous: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireAdministrator();

  const result = await provisionUser(
    {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      email: text(formData, "email"),
      roleId: text(formData, "roleId"),
      moduleIds: formData.getAll("moduleIds").filter((id): id is string => typeof id === "string"),
    },
    administrator,
    createProductionProvisioningPorts(),
  );

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidatePath("/admin/users");
  redirect(`/admin/users?created=${encodeURIComponent(result.user.username)}`);
}

async function changeLifecycle(action: LifecycleAction, formData: FormData): Promise<LifecycleFormState> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireAdministrator();
  const result = await changeUserLifecycle(
    action,
    text(formData, "userId"),
    administrator.id,
    createProductionLifecyclePorts(),
  );

  revalidatePath("/admin/users");
  revalidatePath("/admin/system-logs");

  return { error: result.ok ? null : result.error };
}

export async function deleteUserAction(
  _previous: LifecycleFormState,
  formData: FormData,
): Promise<LifecycleFormState> {
  return changeLifecycle("delete", formData);
}

export async function restoreUserAction(
  _previous: LifecycleFormState,
  formData: FormData,
): Promise<LifecycleFormState> {
  return changeLifecycle("restore", formData);
}
