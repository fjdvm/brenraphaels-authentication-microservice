import { LogsPageSkeleton, SystemLogsHeading } from "@/components/admin/page-headings";

export default function Loading() {
  return <LogsPageSkeleton heading={<SystemLogsHeading />} label="Loading System Logs" />;
}
