import type { Metadata } from "next";
import "../styles/globals.css";

import { cookies } from "next/headers";

import { ThemeProvider } from "@/components/app/theme_provider";
import { I18nProvider } from "@/lib/i18n/i18n";
import type { PortalLangV0 } from "@/lib/i18n/translations";

export const metadata: Metadata = {
  title: "RagicEDP Portal",
  description: "RagicEDP Portal V2 (Mock-first)",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const langCookie = c.get("portal_lang")?.value;
  const initialLang: PortalLangV0 = langCookie === "en" ? "en" : "zh-Hant";

  return (
    <html lang={initialLang === "en" ? "en" : "zh-Hant"} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <I18nProvider initialLang={initialLang}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
