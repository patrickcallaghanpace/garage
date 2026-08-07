"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/lib/constants";

const LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 text-sm">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">·</span>}
          <button
            type="button"
            onClick={() => router.replace(pathname, { locale: l })}
            className={
              l === locale
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }
            aria-current={l === locale}
          >
            {LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
