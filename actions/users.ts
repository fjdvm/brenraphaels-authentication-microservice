"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProductionProvisioningPorts } from "@/lib/admin/user-provisioning.server";
import { createProductionResendPorts } from "@/lib/admin/credential-resend.server";
import { resendCredentials } from "@/lib/admin/credential-resend";
import { provisionUser } from "@/lib/admin/user-provisioning";
import type { CreateUserFormState, ResendOutcome } from "@/lib/admin/user-form-state";
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

export async function resendCredentialsAction(userId: string): Promise<ResendOutcome> {
  // Authority is checked here, in the portal, on every submission.
  const administrator = await requireAdministrator();
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
}
