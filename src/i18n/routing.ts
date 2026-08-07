import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/constants";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Default locale (fr) is unprefixed so the Google Business Profile "Book"
  // link can point at the stable https://yourdomain.com/book — English lives
  // at /en/book.
  localePrefix: "as-needed",
  // Browser Accept-Language detection is off on purpose: /book must always
  // render French deterministically (the target clientele is francophone),
  // with the visible switcher as the only way to get English — not a silent
  // redirect based on the visitor's browser settings.
  localeDetection: false,
});
