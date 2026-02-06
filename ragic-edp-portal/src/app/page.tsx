"use client";

import Link from "next/link";

import { HeaderControls } from "@/components/app/header_controls";
import { useI18n } from "@/lib/i18n/i18n";

export default function HomePage() {
  const { t } = useI18n();

  return (
    <main className="min-h-dvh">
      <header className="border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="text-sm font-semibold tracking-tight">RagicEDP</div>
          <HeaderControls />
        </div>
      </header>

      <div className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">{t("home.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("home.subtitle")}</p>

        <div className="mt-6">
          <Link
            href="/analytics"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("home.goAnalytics")}
          </Link>
        </div>
      </div>
      </div>
    </main>
  );
}
