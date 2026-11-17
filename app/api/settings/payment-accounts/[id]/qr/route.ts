import { getPortalUser } from "@/lib/auth/session";
import { QR_MAX_BYTES, removePaymentAccountQr, replacePaymentAccountQr } from "@/lib/settings/payment-accounts";
import { paymentAccountPorts, signQr } from "@/lib/settings/payment-accounts.server";

const headers = { "Cache-Control": "no-store" };

async function actor(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  const user = await getPortalUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Sign in first." }, { status: 401, headers });
  return { id: user.id, roleName: user.roleName };
}

async function reply(result: Awaited<ReturnType<typeof replacePaymentAccountQr>>) {
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status, headers });
  const [account] = await signQr([result.account]);
  return Response.json({ ok: true, account }, { headers });
}

/** Upload or replace the QR: multipart form data with one `file` field, PNG or JPG up to 2 MB. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await actor(request);
  if (who instanceof Response) return who;
  try {
    // Refuse a huge body before reading it; the form overhead is small.
    if (Number(request.headers.get("content-length") ?? 0) > QR_MAX_BYTES + 64 * 1024) return Response.json({ error: "The QR must be 2 MB or smaller." }, { status: 413, headers });
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a PNG or JPG image to upload." }, { status: 400, headers });
    const { id } = await params;
    return reply(await replacePaymentAccountQr(paymentAccountPorts, who, id, { filename: file.name || "qr", contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }));
  } catch {
    return Response.json({ error: "The QR could not be saved. Nothing was changed." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await actor(request);
  if (who instanceof Response) return who;
  try {
    const { id } = await params;
    return reply(await removePaymentAccountQr(paymentAccountPorts, who, id));
  } catch {
    return Response.json({ error: "The QR could not be removed. Nothing was changed." }, { status: 503, headers });
  }
}
