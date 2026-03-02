"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { HeaderControls } from "@/components/app/header_controls";
import { PageViewTracker } from "@/components/app/page_view_tracker";
import { useI18n } from "@/lib/i18n/i18n";

type NavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

function NavLink({
  href,
  label,
  active,
  onClick,
  indent,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex h-8 items-center rounded-md transition-colors",
        indent ? "pl-6 pr-3 text-xs" : "px-3 text-sm",
        active
          ? "bg-muted/50 font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(isActive);

  // Auto-expand when navigating into this group
  useEffect(() => {
    if (isActive && !open) setOpen(true);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item.children) {
    return <NavLink href={item.href} label={item.label} active={isActive} onClick={onClick} />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "flex h-8 w-full items-center justify-between rounded-md px-3 text-sm transition-colors",
          isActive
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        ].join(" ")}
      >
        {item.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              href={child.href}
              label={child.label}
              active={pathname === child.href}
              onClick={onClick}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSessionRole() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await res.json();
        if (cancelled) return;
        setIsAdmin(session?.user?.role === "admin");
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    loadSessionRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const nav: NavItem[] = [
    { href: "/analytics", label: t("nav.analytics") },
    { href: "/custom-charts", label: t("nav.customCharts") },
    {
      href: "/correction",
      label: t("nav.correction"),
      children: [
        { href: "/correction", label: t("nav.correction.dashboard") },
        { href: "/correction/pending", label: t("nav.correction.pending") },
        { href: "/correction/history", label: t("nav.correction.history") },
        { href: "/correction/schema", label: t("nav.correction.schema") },
        { href: "/correction/backup-logs", label: t("nav.correction.backupLogs") },
      ],
    },
{ href: "/ai", label: t("nav.ai") },
    { href: "/db-ops", label: t("nav.dbops") },
    { href: "/ga4-ops", label: t("nav.ga4Ops") },
    ...(isAdmin ? [{ href: "/admin/users", label: t("nav.userMgmt") }] : []),
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PageViewTracker />
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden min-h-dvh w-48 shrink-0 border-r bg-muted/10 p-4 lg:block">
          <div className="flex h-10 items-center px-2 text-sm font-semibold tracking-tight">RagicEDP</div>
          <nav className="mt-4 space-y-1">
            {nav.map((item) => (
              <NavGroup key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 border-r bg-background p-4 shadow-lg">
              <div className="flex h-10 items-center justify-between px-2">
                <div className="text-sm font-semibold tracking-tight">RagicEDP</div>
                <button type="button" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {nav.map((item) => (
                  <NavGroup
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onClick={() => setMobileMenuOpen(false)}
                  />
                ))}
              </nav>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between px-4 lg:px-6">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border lg:hidden"
                  aria-label="Toggle Menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold tracking-tight lg:hidden">{t("header.portal")}</div>
                <div className="hidden text-sm font-semibold tracking-tight lg:block">{t("header.portal")}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-xs text-muted-foreground sm:block">{t("header.mockFirst")}</div>
                <HeaderControls />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
