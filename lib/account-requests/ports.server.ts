import "server-only";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/notifications.server";
import { createAccountRequestStore } from "./store";

export const accountRequestPorts = {
  ...createAccountRequestStore({ query: sql => prisma.$queryRaw(sql) }),
  notify,
};
