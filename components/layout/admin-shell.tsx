"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { PortalActions } from "@/components/layout/portal-actions";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAVIGATION } from "@/lib/admin/navigation";

type AdminShellProps = {
  children: ReactNode;
  firstName: string;
};

function AdministrativeNavigation() {
  const pathname = usePathname();
  const { setOpenMobile, state } = useSidebar();

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {ADMIN_NAVIGATION.map(({ href, icon: Icon, label }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
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
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-sidebar-border">
        <PortalActions compact={state === "collapsed"} showNotifications={false} />
      </SidebarFooter>
    </>
  );
}

export function AdminShell({ children, firstName }: AdminShellProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex-row items-center gap-3 px-4 py-4">
          <BrandLogo className="rounded-lg" size={36} />
          <span className="truncate font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Bren Raphael&apos;s
          </span>
        </SidebarHeader>
        <AdministrativeNavigation />
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-surface-container-low">
        <AdministrativeHeader firstName={firstName} />
        {children}
      </div>
    </SidebarProvider>
  );
}

function AdministrativeHeader({ firstName }: Pick<AdminShellProps, "firstName">) {
  const { openMobile, state } = useSidebar();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);

  useEffect(() => {
    if (wasDrawerOpen.current && !openMobile) mobileTriggerRef.current?.focus();
    wasDrawerOpen.current = openMobile;
  }, [openMobile]);

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 md:justify-end md:px-6">
      <SidebarTrigger
        aria-expanded={openMobile}
        aria-label={openMobile ? "Close navigation" : "Open navigation"}
        className="md:hidden"
        ref={mobileTriggerRef}
      />
      <SidebarTrigger
        aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:inline-flex"
      />
      <p className="text-sm text-on-surface-variant">{firstName}</p>
    </header>
  );
}
