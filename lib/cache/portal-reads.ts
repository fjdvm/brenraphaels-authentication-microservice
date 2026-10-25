import "server-only";

import { revalidateTag } from "next/cache";

/** Display data only. Sessions, AccessGrants and authorization never use this cache. */
export const PORTAL_READS_TAG = "portal-display-reads";

/** Works in Server Actions and Route Handlers; the next read waits for fresh data. */
export function invalidatePortalReads(): void {
  revalidateTag(PORTAL_READS_TAG, { expire: 0 });
}
