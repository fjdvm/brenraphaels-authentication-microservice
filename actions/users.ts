"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProductionProvisioningPorts } from "@/lib/admin/user-provisioning.server";
import { provisionUser } from "@/lib/admin/user-provisioning";
import { updateUserAccess } from "@/lib/admin/user-access";
import { createProductionAccessPorts } from "@/lib/admin/user-access.server";
import type { EditUserAccessFormState } from "@/lib/admin/user-access-form-state";
import type { CreateUserFormState } from "@/lib/admin/user-form-state";
import { requireAdministrator } from "@/lib/auth/session";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function updateUserAccessAction(
  _previous: EditUserAccessFormState,
  formData: FormData,
): Promise<EditUserAccessFormState> {
  // Authority is re-checked against the live Role on every submission.
  const administrator = await requireAdministrator();

  const result = await updateUserAccess(
    {
      userId: text(formData, "userId"),
      roleId: text(formData, "roleId"),
      moduleIds: formData.getAll("moduleIds").filter((id): id is string => typeof id === "string"),
    },
    administrator,
    createProductionAccessPorts(),
  );

  if (!result.ok) {
    return { error: result.error, saved: false, fieldErrors: result.fieldErrors ?? {} };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${text(formData, "userId")}`);

  return { error: null, saved: true, fieldErrors: {} };
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
