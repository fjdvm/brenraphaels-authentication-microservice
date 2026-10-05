import type { SystemLogEventInput } from "@/lib/audit/system-log";

import type { CredentialsMailer } from "./user-provisioning";

export type ResendTarget = {
  id: string;
  username: string;
  firstName: string;
  email: string;
  neonAuthUserId: string;
  isDeleted: boolean;
  mustChangePassword: boolean;
};

export type ResendPorts = {
  store: {
    findUser(id: string): Promise<ResendTarget | null>;
    markAwaitingFirstLogin(id: string): Promise<void>;
  };
  credentials: {
    /** Replaces the sign-in password and ends the User's existing sessions. */
    replacePassword(neonAuthUserId: string, password: string): Promise<void>;
  };
  mailer: CredentialsMailer;
  audit(event: SystemLogEventInput): Promise<void>;
  generatePassword(): string;
};

export type ResendResult = { ok: true; username: string } | { ok: false; error: string };

/**
 * Issues a fresh Temporary password to an existing non-Deleted User and emails it.
 * The password is replaced before the email is sent, so a delivery failure leaves the
 * User awaiting a working email: the result says so and the action can simply be retried.
 */
export async function resendCredentials(
  userId: string,
  administrator: { id: string },
  ports: ResendPorts,
): Promise<ResendResult> {
  const { store, credentials, mailer, audit } = ports;
  const actorId = administrator.id;
  const record = (outcome: "SUCCESS" | "FAILURE", detail: string, targetUserId?: string) =>
    audit({ action: "user.resend_credentials", outcome, actorId, targetUserId, detail });

  const user = await store.findUser(userId);

  if (!user) {
    await record("FAILURE", "User not found");
    return { ok: false, error: "That User no longer exists." };
  }

  if (user.isDeleted) {
    await record("FAILURE", `Refused: ${user.username} is Deleted`, user.id);
    return { ok: false, error: "Credentials cannot be sent to a Deleted User." };
  }

  const temporaryPassword = ports.generatePassword();

  try {
    await credentials.replacePassword(user.neonAuthUserId, temporaryPassword);
  } catch (error) {
    console.error("Could not replace a User's password", error);
    await record("FAILURE", `Password replacement failed for ${user.username}`, user.id);
    return {
      ok: false,
      error: `The password was not changed and nothing was sent to ${user.username}. Try again shortly.`,
    };
  }

  const recoverable = `${user.username}'s password was replaced but could not be emailed, so they cannot sign in yet. Resend credentials again once the problem is fixed.`;

  try {
    await store.markAwaitingFirstLogin(user.id);
  } catch (error) {
    console.error("Could not flag a User for a password change", error);
    await record("FAILURE", `Could not require a password change for ${user.username}`, user.id);
    return { ok: false, error: recoverable };
  }

  try {
    await mailer.sendCredentials({
      to: user.email,
      firstName: user.firstName,
      username: user.username,
      temporaryPassword,
      kind: "resend",
    });
  } catch (error) {
    console.error("Could not email resent credentials", error);
    await record("FAILURE", `Credentials email failed for ${user.username}`, user.id);
    return { ok: false, error: recoverable };
  }

  await record("SUCCESS", `Resent credentials to ${user.username}`, user.id);
  return { ok: true, username: user.username };
}
