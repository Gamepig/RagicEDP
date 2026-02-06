"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { HeaderControls } from "@/components/app/header_controls";
import { useI18n } from "@/lib/i18n/i18n";

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        active
          ? "flex h-9 items-center rounded-md bg-muted/50 px-3 text-sm font-medium text-foreground transition-colors"
          : "flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nav = [
    { href: "/analytics", label: t("nav.analytics") },
    { href: "/correction", label: t("nav.correction") },
    { href: "/ai", label: t("nav.ai") },
    { href: "/db-ops", label: t("nav.dbops") },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden min-h-dvh w-64 border-r bg-muted/10 p-4 lg:block">
          <div className="flex h-10 items-center px-2 text-sm font-semibold tracking-tight">RagicEDP</div>
          <nav className="mt-4 space-y-1">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
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
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={pathname === item.href}
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
