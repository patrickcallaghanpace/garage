"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/lib/constants";

const LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

/** Colour-agnostic: inherits the surrounding text colour, so it works on dark and light bars. */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center text-sm font-semibold" role="group" aria-label="Language">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="opacity-40" aria-hidden>/</span>}
          <button
            type="button"
            onClick={() => router.replace(pathname, { locale: l })}
            className={`flex min-h-11 min-w-9 items-center justify-center px-1.5 transition-opacity ${
              l === locale ? "opacity-100" : "opacity-55 hover:opacity-100"
            }`}
            aria-current={l === locale ? "true" : undefined}
          >
            {LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
