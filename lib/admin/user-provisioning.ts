import {
  createUserSchema,
  fieldErrorsFrom,
  type CreateUserInput,
  type FieldErrors,
} from "@/lib/validations/user";

import type { SystemLogEventInput } from "@/lib/audit/system-log";

/** Thrown by the store when the Email unique constraint rejects a concurrent creation. */
export class DuplicateEmailError extends Error {
  constructor() {
    super("A User with this Email already exists.");
  }
}

export type ProvisioningStore = {
  emailExists(email: string): Promise<boolean>;
  roleExists(roleId: string): Promise<boolean>;
  /** How many of the given Module ids exist. */
  countModules(moduleIds: string[]): Promise<number>;
  /**
   * One transaction: advance the Username sequence, insert the User (Awaiting first
   * login) and its AccessGrants. Throws DuplicateEmailError on an Email collision.
   */
  createUser(input: {
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    neonAuthUserId: string;
    moduleIds: string[];
    grantedBy: string;
  }): Promise<{ id: string; username: string; systemNames: string[] }>;
  /** Undo a creation whose credentials could not be delivered. */
  discardUser(id: string): Promise<void>;
};

export type IdentityProvisioner = {
  create(input: { email: string; name: string; password: string }): Promise<{ id: string }>;
  remove(id: string): Promise<void>;
};

export type CredentialsMailer = {
  sendCredentials(message: {
    to: string;
    firstName: string;
    username: string;
    temporaryPassword: string;
  }): Promise<void>;
};

export type ProvisioningPorts = {
  store: ProvisioningStore;
  identity: IdentityProvisioner;
  mailer: CredentialsMailer;
  audit(event: SystemLogEventInput): Promise<void>;
  generatePassword(): string;
};

export type ProvisionResult =
  | { ok: true; user: { id: string; username: string; email: string } }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const EMAIL_TAKEN = "A User with this Email already exists. Use a different Email.";

function failure(error: string, fieldErrors?: FieldErrors): ProvisionResult {
  return { ok: false, error, fieldErrors };
}

/**
 * Creates a User end to end. Order matters for the failure guarantees: the Neon Auth
 * identity and portal record are created first, and the credentials email is sent last;
 * if it cannot be delivered, both are undone so the Administrator can retry the same
 * form without a duplicate identity, an orphaned grant or a false success.
 */
export async function provisionUser(
  input: CreateUserInput,
  administrator: { id: string },
  ports: ProvisioningPorts,
): Promise<ProvisionResult> {
  const { store, identity, mailer, audit } = ports;
  const actorId = administrator.id;
  const logFailure = (detail: string) =>
    audit({ action: "user.create", outcome: "FAILURE", actorId, detail });

  const parsed = createUserSchema.safeParse(input);

  if (!parsed.success) {
    await logFailure("Invalid User information");
    return failure("Check the highlighted fields and try again.", fieldErrorsFrom(parsed.error));
  }

  const { firstName, lastName, email, roleId, moduleIds } = parsed.data;
  const fieldErrors: FieldErrors = {};

  if (!(await store.roleExists(roleId))) {
    fieldErrors.roleId = "Choose a valid Role.";
  }

  if (moduleIds.length > 0 && (await store.countModules(moduleIds)) !== moduleIds.length) {
    fieldErrors.moduleIds = "One of the selected Modules no longer exists. Reload and select again.";
  }

  if (!fieldErrors.roleId && !fieldErrors.moduleIds && (await store.emailExists(email))) {
    fieldErrors.email = EMAIL_TAKEN;
  }

  if (Object.keys(fieldErrors).length > 0) {
    await logFailure(fieldErrors.email ? `Email already in use: ${email}` : "Invalid Role or Module selection");
    return failure("Check the highlighted fields and try again.", fieldErrors);
  }

  const temporaryPassword = ports.generatePassword();
  let neonAuthUserId: string;

  try {
    ({ id: neonAuthUserId } = await identity.create({
      email,
      name: `${firstName} ${lastName}`,
      password: temporaryPassword,
    }));
  } catch (error) {
    // A concurrent request for the same Email may have won the race to Neon Auth.
    if (await store.emailExists(email).catch(() => false)) {
      await logFailure(`Email already in use: ${email}`);
      return failure("Check the highlighted fields and try again.", { email: EMAIL_TAKEN });
    }

    console.error("Neon Auth could not provision a User", error);
    await logFailure(`Identity provisioning failed for ${email}`);
    return failure(
      "The sign-in identity could not be created. Nothing was created; try again shortly.",
    );
  }

  let created: Awaited<ReturnType<ProvisioningStore["createUser"]>>;

  try {
    created = await store.createUser({
      firstName,
      lastName,
      email,
      roleId,
      neonAuthUserId,
      moduleIds,
      grantedBy: actorId,
    });
  } catch (error) {
    await identity.remove(neonAuthUserId).catch((cleanupError) => {
      console.error("Could not remove an orphaned Neon Auth identity", neonAuthUserId, cleanupError);
    });

    if (error instanceof DuplicateEmailError) {
      await logFailure(`Email already in use: ${email}`);
      return failure("Check the highlighted fields and try again.", { email: EMAIL_TAKEN });
    }

    console.error("Could not save a new User", error);
    await logFailure(`Saving the User failed for ${email}`);
    return failure("The User could not be saved. Nothing was created; try again shortly.");
  }

  try {
    await mailer.sendCredentials({
      to: email,
      firstName,
      username: created.username,
      temporaryPassword,
    });
  } catch (error) {
    console.error("Could not email new User credentials", error);

    try {
      await store.discardUser(created.id);
      await identity.remove(neonAuthUserId);
    } catch (cleanupError) {
      console.error("Could not undo a User whose email failed", created.id, cleanupError);
      await logFailure(`Credentials email failed and cleanup is incomplete for ${created.username}`);
      return failure(
        `The credentials email could not be sent and ${created.username} could not be fully removed. Contact support before retrying.`,
      );
    }

    await logFailure(`Credentials email failed for ${email}; creation undone`);
    return failure(
      "The credentials email could not be sent, so the User was not created. Check the email configuration and try again.",
    );
  }

  await audit({
    action: "user.create",
    outcome: "SUCCESS",
    actorId,
    targetUserId: created.id,
    detail: `Created ${created.username}`,
  });

  if (moduleIds.length > 0) {
    await audit({
      action: "access.grant",
      outcome: "SUCCESS",
      actorId,
      targetUserId: created.id,
      detail: `${moduleIds.length} Module${moduleIds.length === 1 ? "" : "s"} granted at creation (${created.systemNames.join(", ")})`,
    });
  }

  return { ok: true, user: { id: created.id, username: created.username, email } };
}
