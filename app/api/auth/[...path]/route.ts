import { auth } from "@/lib/auth/server";
import { invalidatePortalReads } from "@/lib/cache/portal-reads";

const handlers = auth.handler();

export const GET = handlers.GET;

export async function POST(request: Request, context: RouteContext<"/api/auth/[...path]">) {
  try {
    return await handlers.POST(request, context);
  } finally {
    invalidatePortalReads();
  }
}
