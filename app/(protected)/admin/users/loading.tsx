import { UserDirectorySkeleton, UserManagementFrame } from "@/components/admin/user-management-screen";

export default function Loading() {
  return (
    <UserManagementFrame>
      <UserDirectorySkeleton />
    </UserManagementFrame>
  );
}
