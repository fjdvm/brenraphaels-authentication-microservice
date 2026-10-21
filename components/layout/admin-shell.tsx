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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { SIDEBAR_NAVIGATION } from "@/lib/admin/navigation";

type AdminShellProps = {
  children: ReactNode;
  user: ShellUser;
};

// Figma "Portal sidebar" is 256px wide.
const SIDEBAR_STYLE = { "--sidebar-width": "16rem" } as CSSProperties;

function AdministrativeNavigation({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <SidebarContent className="px-3 py-4">
        <SidebarMenu className="gap-0.5">
          {SIDEBAR_NAVIGATION.map(({ href, icon: Icon, label }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                className="h-auto gap-3 rounded-lg px-2.5 py-[9px] text-[15px] leading-[normal] font-medium text-nav-foreground data-[active=true]:font-medium [&>svg]:size-[18px]"
                isActive={pathname === href}
                onClick={() => setOpenMobile(false)}
                tooltip={label}
              >
                <Link aria-current={pathname === href ? "page" : undefined} href={href}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="gap-2.5 border-t border-border px-3 py-3.5">
        <UserCard user={user} />
        <LogoutButton layout="sidebar" />
      </SidebarFooter>
    </>
  );
}

export function AdminShell({ children, user }: AdminShellProps) {
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b border-border py-[18px] pl-3.5 pr-2.5">
          <BrandLockup size="sidebar" />
        </SidebarHeader>
        <AdministrativeNavigation user={user} />
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
