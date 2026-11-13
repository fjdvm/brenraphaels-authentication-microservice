"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { BrandLockup } from "@/components/layout/brand-lockup";
import { LogoutButton, NotificationButton } from "@/components/layout/portal-actions";
import { type ShellUser, UserCard } from "@/components/layout/user-identity";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { ACCOUNT_REQUESTS_HREF, SIDEBAR_SECTIONS } from "@/lib/admin/navigation";

type AdminShellProps = {
  children: ReactNode;
  user: ShellUser;
  /** Requests waiting for an Administrator; shown as a badge on Account requests. */
  newAccountRequests?: number;
};

// Matches the CREOMS sidebar (296px), so the Portal and CREOMS feel like one product.
const SIDEBAR_STYLE = { "--sidebar-width": "18.5rem" } as CSSProperties;

function AdministrativeNavigation({ user, newAccountRequests = 0 }: { user: ShellUser; newAccountRequests?: number }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarContent className="px-5 py-6">
        {SIDEBAR_SECTIONS.map(({ label: sectionLabel, destinations }, index) => (
          <SidebarGroup className="p-0" key={sectionLabel ?? index}>
            {sectionLabel ? (
              <SidebarGroupLabel className="mt-1.5 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-nav-section">
                {sectionLabel}
              </SidebarGroupLabel>
            ) : null}
            <SidebarMenu className="gap-1">
              {destinations.map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    className="h-auto gap-2 rounded-lg px-2.5 py-[10px] text-[15px] leading-[normal] font-normal text-nav-foreground data-[active=true]:font-semibold data-[active=true]:text-foreground [&>svg]:size-4"
                    isActive={pathname === href}
                    onClick={() => setOpenMobile(false)}
                    tooltip={label}
                  >
                    <Link aria-current={pathname === href ? "page" : undefined} href={href}>
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {href === ACCOUNT_REQUESTS_HREF && newAccountRequests > 0 ? (
                    <SidebarMenuBadge
                      aria-label={`${newAccountRequests} new`}
                      className="right-2.5 h-5 min-w-5 rounded-full bg-identity px-1.5 text-[11px] font-semibold text-on-primary peer-data-[active=true]/menu-button:text-on-primary"
                    >
                      {newAccountRequests}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2.5 border-t border-border px-4 py-3.5">
        <UserCard user={user} />
        <LogoutButton description="You will be signed out of the portal and every system you opened." layout="sidebar" />
      </SidebarFooter>
    </>
  );
}

export function AdminShell({ children, user, newAccountRequests }: AdminShellProps) {
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b border-border py-[18px] pl-3.5 pr-2.5">
          <BrandLockup size="sidebar" />
        </SidebarHeader>
        <AdministrativeNavigation newAccountRequests={newAccountRequests} user={user} />
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-surface">
        <AdministrativeHeader />
        {children}
      </div>
    </SidebarProvider>
  );
}

function AdministrativeHeader() {
  const { openMobile, state, toggleSidebar } = useSidebar();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);

  useEffect(() => {
    if (wasDrawerOpen.current && !openMobile) mobileTriggerRef.current?.focus();
    wasDrawerOpen.current = openMobile;
  }, [openMobile]);

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-6">
      <Button
        aria-expanded={openMobile}
        aria-label={openMobile ? "Close navigation" : "Open navigation"}
        className="size-8 text-foreground md:hidden [&_svg:not([class*='size-'])]:size-[18px]"
        onClick={toggleSidebar}
        ref={mobileTriggerRef}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Button
        aria-expanded={state === "expanded"}
        aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden size-8 text-foreground md:inline-flex [&_svg:not([class*='size-'])]:size-[18px]"
        onClick={toggleSidebar}
        size="icon"
        type="button"
        variant="ghost"
      >
        <PanelLeft aria-hidden="true" />
      </Button>
      <NotificationButton className="ml-auto" />
    </header>
  );
}
