import { z } from "zod";
import { parseBasicCredentials } from "../integrations/basic";
import { hashToken, safeEqual } from "../integrations/tokens";
import type { Notifier } from "../notifications/notifications";

const text = z.string().trim().min(1).max(250);
const email = z.email().max(254).transform(value => value.toLowerCase());
const schema = z.object({
  reference: z.string().regex(/^RQ-\d{4,}$/).max(50),
  employee: z.object({ name: text, workEmail: email, personalEmail: email, mobile: z.string().trim().max(50).nullable(), position: text, branch: text, startDate: z.iso.date() }),
  roleId: text,
  moduleIds: z.array(text).max(1000).refine(ids => new Set(ids).size === ids.length),
  neededFrom: z.iso.date(),
  note: z.string().trim().max(5000).nullable(),
  requestedBy: z.object({ name: text }),
});
export type AccountRequestInput = z.infer<typeof schema>;
export type RequestReceipt = { reference: string; status: string };
export type RequestOptions = {
  roles: { id: string; name: string; moduleIds: string[] }[];
  systems: { id: string; name: string; modules: { id: string; name: string }[] }[];
};
export type ReceiveResult = { kind: "created" | "duplicate"; request: RequestReceipt } | { kind: "email-taken" };
export type AccountRequestPorts = {
  findSystemByName(name: string): Promise<{ id: string; backendSecretHash: string | null } | null>;
  options(): Promise<RequestOptions>;
  findRequest(systemId: string, reference: string): Promise<RequestReceipt | null>;
  receive(systemId: string, input: AccountRequestInput): Promise<ReceiveResult>;
  administratorIds(): Promise<string[]>;
  notify: Notifier;
};
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function authenticate(request: Request, ports: AccountRequestPorts) {
  const credentials = parseBasicCredentials(request.headers.get("authorization"));
  // Only HRMS may submit personal data or enumerate the cross-System access matrix.
  if (credentials?.name !== "HRMS") return null;
  const system = await ports.findSystemByName(credentials.name);
  return system?.backendSecretHash && safeEqual(hashToken(credentials.secret), system.backendSecretHash) ? system : null;
}

export async function handleAccountRequest(request: Request, ports: AccountRequestPorts): Promise<Response> {
  try {
    const system = await authenticate(request, ports);
    if (!system) return json({ error: "invalid_client" }, 401);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid-request" }, 400);
    const input = parsed.data;
    // A retry remains successful even after a User was created or a Module retired.
    const existing = await ports.findRequest(system.id, input.reference);
    if (existing) return json(existing);
    const options = await ports.options();
    const modules = new Set(options.systems.flatMap(system => system.modules.map(module => module.id)));
    if (!options.roles.some(role => role.id === input.roleId) || input.moduleIds.some(id => !modules.has(id))) {
      return json({ error: "invalid-access" }, 400);
    }
    const result = await ports.receive(system.id, input);
    if (result.kind === "email-taken") return json({ error: "email-taken" }, 409);
    if (result.kind === "created") {
      // Match the Portal's best-effort notification policy: an inbox outage must
      // never turn a persisted request into an apparent failed delivery.
      try {
        await Promise.all((await ports.administratorIds()).map(userId => ports.notify({
          userId, type: "account-request.new", title: `New Account request ${input.reference}`,
          body: `${input.requestedBy.name} requested a Portal account for ${input.employee.name}.`,
        })));
      } catch (error) { console.error("Could not notify Administrators of an Account request", error); }
    }
    return json(result.request, result.kind === "created" ? 201 : 200);
  } catch {
    return json({ error: "temporarily_unavailable" }, 503);
  }
}

export async function handleAccountRequestOptions(request: Request, ports: AccountRequestPorts): Promise<Response> {
  try {
    if (!await authenticate(request, ports)) return json({ error: "invalid_client" }, 401);
    return json(await ports.options());
  } catch {
    return json({ error: "temporarily_unavailable" }, 503);
  }
}


export type AccountRequestActionPorts = AccountRequestPorts & {
  cancel(systemId: string, reference: string): Promise<RequestReceipt | null>;
};

/** HRMS owns reminder throttling; the Portal is authoritative for terminal statuses. */
export async function handleAccountRequestAction(request: Request, reference: string, action: "remind" | "cancel", ports: AccountRequestActionPorts): Promise<Response> {
  try {
    const system = await authenticate(request, ports);
    if (!system) return json({ error: "invalid_client" }, 401);
    if (!z.string().regex(/^RQ-\d{4,}$/).max(50).safeParse(reference).success) return json({ error: "invalid-request" }, 400);
    const saved = action === "cancel"
      ? await ports.cancel(system.id, reference)
      : await ports.findRequest(system.id, reference);
    if (!saved) return json({ error: "not-found" }, 404);
    if (action === "cancel" && saved.status === "cancelled") return json({ status: "cancelled" });
    if (!["new", "seen"].includes(saved.status)) {
      // Translate the Portal label to the shared wire status.
      return json({ status: saved.status === "created" ? "account_created" : saved.status }, 409);
    }
    await Promise.all((await ports.administratorIds()).map(userId => ports.notify({
      userId, type: "account-request.reminder", title: `Reminder: Account request ${reference}`,
      body: `HR is waiting for Account request ${reference}. Open Account requests to review it.`,
    })));
    return json({ status: saved.status === "new" ? "requested" : saved.status });
  } catch {
    return json({ error: "temporarily_unavailable" }, 503);
  }
}
