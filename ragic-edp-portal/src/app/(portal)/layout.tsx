"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeaderControls } from "@/components/app/header_controls";
import { useI18n } from "@/lib/i18n/i18n";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex h-9 items-center rounded-md bg-muted/50 px-3 text-sm font-medium text-foreground"
          : "flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const nav = [
    { href: "/analytics", label: t("nav.analytics") },
    { href: "/correction", label: t("nav.correction") },
    { href: "/ai", label: t("nav.ai") },
    { href: "/db-ops", label: t("nav.dbops") },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden min-h-dvh w-64 border-r bg-muted/30 p-4 lg:block">
          <div className="flex h-10 items-center px-2 text-sm font-semibold tracking-tight">RagicEDP</div>
          <nav className="mt-4 space-y-1">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="text-sm font-semibold tracking-tight">{t("header.portal")}</div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">{t("header.mockFirst")}</div>
                <HeaderControls />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
