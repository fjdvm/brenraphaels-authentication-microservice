import { LogsPageSkeleton, MyLogsHeading } from "@/components/admin/page-headings";

export default function Loading() {
  return <LogsPageSkeleton heading={<MyLogsHeading />} label="Loading Activity log" />;
}
