import { provisionUser, type ProvisioningPorts, type CredentialsMailer } from "@/lib/admin/user-provisioning";
import type { CreateUserInput } from "@/lib/validations/user";

export type FulfillmentPorts = {
  findRequest(id: string): Promise<{ workEmail: string; personalEmail: string; status: string } | null>;
  // createUser must atomically claim the open request, insert User/grants and queue account_created.
  provisioning: ProvisioningPorts;
  loginSent(id: string, actor: string): Promise<void>;
};

/** A committed account survives email failure. The administrator can resend without creating another User. */
export async function createFromRequest(id: string, input: CreateUserInput, administrator: { id: string }, ports: FulfillmentPorts) {
  const request = await ports.findRequest(id);
  if (!request || !["new", "seen"].includes(request.status)) return { ok: false as const, error: "This request is no longer open. Reload to see its status." };
  const messages: Parameters<CredentialsMailer["sendCredentials"]>[0][] = [];
  const result = await provisionUser({ ...input, email: request.workEmail }, administrator, {
    ...ports.provisioning,
    mailer: { async sendCredentials(message) { messages.push(message); } },
  });
  if (!result.ok) return result;
  try {
    for (const message of messages) {
      for (const to of new Set([request.workEmail, request.personalEmail])) {
        await ports.provisioning.mailer.sendCredentials({ ...message, to });
      }
    }
    await ports.loginSent(id, administrator.id);
  } catch {
    return { ok: false as const, error: "The account was created, but login delivery was not confirmed. Open the request and resend login details." };
  }
  return result;
}
