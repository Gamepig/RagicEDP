"use client";

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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = useMemo(() => {
    const v = theme === "system" ? resolvedTheme : theme;
    return v === "dark" ? "dark" : "light";
  }, [theme, resolvedTheme]);

  return (
    <div className="flex items-center gap-2">
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
