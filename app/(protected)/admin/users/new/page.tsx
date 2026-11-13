import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createRequestUserAction } from "@/actions/account-requests";
import { connection } from "next/server";

import { createUserAction } from "@/actions/users";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { NewUserHeading } from "@/components/admin/page-headings";
import { loadUserFormOptions } from "@/lib/admin/user-form-options";
import { requireAdministrator } from "@/lib/auth/session";

/** Figma "Portal · Add new user". */
export default async function NewUserPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  await connection();
  await requireAdministrator();
  const { request: requestId } = await searchParams;
  const request = requestId ? await prisma.accountRequest.findUnique({ where: { id: requestId } }) : null;
  // A committed account can outlive failed login delivery. A refresh must reach its Resend action, not a 404.
  if (request?.status === "created") redirect(`/admin/account-requests?request=${encodeURIComponent(request.id)}`);
  if (requestId && (!request || !["new", "seen"].includes(request.status))) notFound();
  const names = request?.personName.trim().split(/\s+/) ?? [];
  const prefill = request ? { id: request.id, reference: request.reference, requesterName: request.requesterName, note: request.note, firstName: names.slice(0, -1).join(" ") || names[0], lastName: names.length > 1 ? names.at(-1)! : "", email: request.workEmail, roleId: request.roleId, moduleIds: request.moduleIds } : undefined;
  const { roles, systems } = await loadUserFormOptions();

  return (
    <main className="flex w-full flex-1 flex-col">
      <NewUserHeading fromRequest={Boolean(request)} />
      <CreateUserForm request={prefill} action={request ? createRequestUserAction.bind(null, request.id) : createUserAction} roles={roles} systems={systems} />
    </main>
  );
}
