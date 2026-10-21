import { handleInbox } from "@/lib/notifications/endpoints";
import { notificationsDeps } from "@/lib/notifications/notifications.server";

export function GET(): Promise<Response> {
  return handleInbox(notificationsDeps);
}
