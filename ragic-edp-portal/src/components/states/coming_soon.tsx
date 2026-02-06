"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n/i18n";
import type { TranslationKeyV0 } from "@/lib/i18n/translations";

export function ComingSoon(props: { titleKey: TranslationKeyV0; subtitleKey: TranslationKeyV0 }) {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">{t(props.titleKey)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t(props.subtitleKey)}</p>

      <div className="mt-8 rounded-xl border bg-background p-6">
        <div className="text-sm font-semibold tracking-tight">{t("common.comingSoon")}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.goAnalyticsHint")}</p>

        <div className="mt-5">
          <Link
            href="/analytics"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("common.goAnalytics")}
          </Link>
        </div>
      </div>
    </div>
  );
}
