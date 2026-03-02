"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n/i18n";

function setCookie(name: string, value: string) {
  const maxAgeDays = 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeDays * 24 * 60 * 60}`;
}

export function HeaderControls() {
  // Avoid hydration mismatch: server can't know system theme; next-themes resolves on client.
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    image?: string;
  } | null>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    async function loadSessionUser() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await res.json();
        if (cancelled) return;
        setUser(session?.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    loadSessionUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentTheme = useMemo(() => {
    const v = theme === "system" ? resolvedTheme : theme;
    return v === "dark" ? "dark" : "light";
  }, [theme, resolvedTheme]);

  return (
    <div className="flex items-center gap-2">
      {user && (
        <div className="mr-1 flex items-center gap-2 rounded-md border px-2 py-1">
          {user.image ? (
            <img src={user.image} alt={user.name ?? user.email ?? "user"} className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {(user.name?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
            </div>
          )}
          <div className="hidden min-w-0 max-w-[180px] sm:block">
            <div className="truncate text-xs font-medium">{user.name ?? t("header.userFallback")}</div>
            <div className="truncate text-[10px] text-muted-foreground">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted/50"
          >
            {t("header.signOut")}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          const next = currentTheme === "dark" ? "light" : "dark";
          setTheme(next);
        }}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
      >
        {mounted ? (currentTheme === "dark" ? t("theme.dark") : t("theme.light")) : t("theme.toggle")}
      </button>

      <button
        type="button"
        onClick={() => {
          const next = lang === "zh-Hant" ? "en" : "zh-Hant";
          setLang(next);
          setCookie("portal_lang", next);
        }}
        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
      >
        {lang === "zh-Hant" ? "EN" : "中文"}
      </button>
    </div>
  );
}
