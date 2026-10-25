import { LogsPageSkeleton, MyLogsHeading } from "@/components/admin/page-headings";

// The shell depends on the signed-in User's Role, so the page renders it; this only covers the content.
export default function Loading() {
  return <LogsPageSkeleton heading={<MyLogsHeading />} label="Loading Activity log" />;
}
