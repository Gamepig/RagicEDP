"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { PortalLangV0, TranslationKeyV0, translationsV0 } from "./translations";

type I18nContextV0 = {
  lang: PortalLangV0;
  setLang: (lang: PortalLangV0) => void;
  t: (key: TranslationKeyV0) => string;
};

const I18nContext = createContext<I18nContextV0 | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: PortalLangV0; children: React.ReactNode }) {
  const [lang, setLang] = useState<PortalLangV0>(initialLang);

  const t = useCallback(
    (key: TranslationKeyV0) => {
      return translationsV0[lang][key] ?? translationsV0["en"][key] ?? key;
    },
    [lang]
  );

  const value = useMemo<I18nContextV0>(() => ({ lang, setLang, t }), [lang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextV0 {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
