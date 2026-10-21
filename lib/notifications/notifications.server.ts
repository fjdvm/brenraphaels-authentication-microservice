import "server-only";

import { getPortalUser } from "@/lib/auth/session";

import { createNotificationsClient, type NotificationsClient } from "./notifications";

/**
 * The Portal's connection to the notifications service, through the api-gateway with the
 * Portal's Caller key. Both stay on the server. If they are not configured, every call
 * fails and the bell simply shows nothing.
 */
const client: NotificationsClient = createNotificationsClient({
  baseUrl: process.env.API_GATEWAY_URL ?? "",
  callerKey: process.env.API_GATEWAY_KEY ?? "",
  app: process.env.NOTIFICATIONS_APP ?? "Portal",
});

export const notificationsDeps = {
  resolveUser: getPortalUser,
  client,
};
