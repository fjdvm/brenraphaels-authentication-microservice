-- System Logs now live only in the audit-logs service; the local copy is dropped with no backfill.
DROP TABLE "SystemLogEvent";

DROP TYPE "SystemLogOutcome";
