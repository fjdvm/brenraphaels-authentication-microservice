"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProductionProvisioningPorts } from "@/lib/admin/user-provisioning.server";
import { createProductionLifecyclePorts } from "@/lib/admin/user-lifecycle.server";
import { changeUserLifecycle, type LifecycleAction } from "@/lib/admin/user-lifecycle";
import { createProductionResendPorts } from "@/lib/admin/credential-resend.server";
import { resendCredentials } from "@/lib/admin/credential-resend";
import { provisionUser } from "@/lib/admin/user-provisioning";
import type { LifecycleFormState } from "@/lib/admin/user-lifecycle-state";
import { updateUserAccess } from "@/lib/admin/user-access";
import { createProductionAccessPorts } from "@/lib/admin/user-access.server";
import type { EditUserAccessFormState } from "@/lib/admin/user-access-form-state";
import type { CreateUserFormState, ResendOutcome } from "@/lib/admin/user-form-state";
import { invalidatePortalReads } from "@/lib/cache/portal-reads";
import { requireFullAccess } from "@/lib/auth/session";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function updateUserAccessAction(
  _previous: EditUserAccessFormState,
  formData: FormData,
): Promise<EditUserAccessFormState> {
  // Authority is re-checked against the live Role on every submission.
  const administrator = await requireFullAccess();

  try {
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
  } finally {
    invalidatePortalReads();
  }
}

export async function createUserAction(
  _previous: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireFullAccess();

  try {
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
  } finally {
    invalidatePortalReads();
  }
}

async function changeLifecycle(action: LifecycleAction, formData: FormData): Promise<LifecycleFormState> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireFullAccess();

  try {
    const result = await changeUserLifecycle(
      action,
      text(formData, "userId"),
      administrator.id,
      createProductionLifecyclePorts(),
    );

    revalidatePath("/admin/users");
    revalidatePath("/admin/system-logs");

    return { error: result.ok ? null : result.error };
  } finally {
    invalidatePortalReads();
  }
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

export async function resendCredentialsAction(userId: string): Promise<ResendOutcome> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireFullAccess();

  try {
    let result: Awaited<ReturnType<typeof resendCredentials>>;

    try {
      result = await resendCredentials(userId, administrator, createProductionResendPorts());
    } catch (error) {
      console.error("Resend credentials failed unexpectedly", error);
      return { status: "error", message: "Credentials could not be sent. Nothing was confirmed as delivered; try again shortly." };
    }

    revalidatePath("/admin/users");

    return result.ok
      ? {
          status: "success",
          message: `New credentials were emailed to ${result.username}. They must change their password at next login.`,
        }
      : { status: "error", message: result.error };
  } finally {
    invalidatePortalReads();
  }
}
