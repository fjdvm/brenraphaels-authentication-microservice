"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { NotificationButton, PortalActions } from "@/components/layout/portal-actions";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_NAVIGATION } from "@/lib/admin/navigation";

type AdminShellProps = {
  children: ReactNode;
};

function AdministrativeNavigation() {
  const pathname = usePathname();
  const { setOpenMobile, state } = useSidebar();

  return (
    <>
      <SidebarContent className="border-t border-border pt-3">
        <SidebarGroup className="px-3">
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
      <SidebarFooter className="mt-auto border-t border-border">
        <PortalActions compact={state === "collapsed"} showNotifications={false} />
      </SidebarFooter>
    </>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="items-start gap-2 px-4 py-5">
          <div className="flex items-stretch gap-3">
            <BrandLogo
              className="aspect-square h-auto w-auto shrink-0 self-stretch rounded-lg object-contain"
              size={60}
            />
            <div className="flex min-w-0 flex-col items-start justify-center gap-1 group-data-[collapsible=icon]:hidden">
              <span className="truncate text-2xl font-bold tracking-tight text-sidebar-foreground">
                Bren Raphael&apos;s
              </span>
              <span className="rounded-md bg-violet-600 px-2 py-1 text-xs font-semibold text-white">
                Enterprise Suite
              </span>
            </div>
          </div>
        </SidebarHeader>
        <AdministrativeNavigation />
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
    <header className="flex h-16 items-center border-b border-border bg-surface">
      <div className="relative flex h-full w-16 shrink-0 items-center justify-center">
        <Button
          aria-expanded={openMobile}
          aria-label={openMobile ? "Close navigation" : "Open navigation"}
          className="md:hidden"
          onClick={toggleSidebar}
          ref={mobileTriggerRef}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Menu aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-expanded={state === "expanded"}
          aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex"
          onClick={toggleSidebar}
          size="icon"
          type="button"
          variant="ghost"
        >
          <PanelLeft aria-hidden="true" className="size-4 text-foreground" strokeWidth={2} />
        </Button>
        <span aria-hidden="true" className="absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-border" />
      </div>
      <NotificationButton className="ml-auto mr-4" />
    </header>
  );
}
