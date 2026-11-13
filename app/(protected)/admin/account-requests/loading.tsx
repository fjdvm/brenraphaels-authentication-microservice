import { AccountRequestsHeading, LogsPageSkeleton } from "@/components/admin/page-headings";

export default function Loading() {
  return <LogsPageSkeleton heading={<AccountRequestsHeading />} label="Loading Account requests" />;
}
