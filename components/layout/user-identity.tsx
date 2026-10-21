import { cn } from "@/lib/utils/cn";

/** The signed-in User as the shell shows them; never anything a browser must not hold. */
export type ShellUser = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  roleName: string;
};

export function initialsOf({ firstName, lastName }: Pick<ShellUser, "firstName" | "lastName">) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

const AVATAR_SIZES = {
  sm: "size-8 text-xs",
  md: "size-9 text-[13px]",
  lg: "size-11 text-[15px]",
} as const;

export function UserAvatar({
  user,
  size,
  tone = "solid",
}: {
  user: Pick<ShellUser, "firstName" | "lastName">;
  size: keyof typeof AVATAR_SIZES;
  /** Figma's user table shows Administrators solid and everyone else soft. */
  tone?: "solid" | "soft";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold leading-[normal]",
        tone === "solid" ? "bg-identity text-identity-foreground" : "bg-identity-soft text-identity",
        AVATAR_SIZES[size],
      )}
    >
      {initialsOf(user)}
    </span>
  );
}

/** Figma "Portal sidebar" profile card: who is signed in, and their Role. */
export function UserCard({ user }: { user: ShellUser }) {
  return (
    <section
      aria-label="Signed in as"
      className="flex w-full items-center gap-3 rounded-xl border border-identity-border bg-surface py-3.5 pl-3.5 pr-3"
    >
      <UserAvatar size="lg" user={user} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <p className="w-full truncate text-[15px] font-bold leading-[normal] text-foreground">
          {user.firstName} {user.lastName}
        </p>
        <p className="w-full truncate text-xs leading-[normal] text-on-surface-variant">{user.username}</p>
        <p className="w-full truncate text-xs leading-[normal] text-on-surface-variant">{user.email}</p>
        <p className="pt-1">
          <span className="block rounded-full bg-identity-badge px-2 py-0.5 text-[11px] font-semibold leading-[normal] text-identity">
            {user.roleName}
          </span>
        </p>
      </div>
    </section>
  );
}
