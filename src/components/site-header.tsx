import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { env } from "@/lib/env";
import { brand } from "@/lib/brand";

export async function SiteHeader() {
  const tNav = await getTranslations("Nav");
  const name = env.businessName ?? brand.name;

  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link href="/" className="display py-3 text-2xl sm:text-3xl" aria-label={name}>
          {name}
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <a
            href={brand.phoneHref}
            className="hidden min-h-11 items-center text-sm font-semibold opacity-80 hover:opacity-100 md:flex"
          >
            {brand.phoneDisplay}
          </a>
          <LocaleSwitcher />
          <Link
            href="/book"
            className="flex min-h-11 items-center bg-signal px-4 text-sm font-bold uppercase tracking-wide text-signal-foreground transition-transform hover:-translate-y-px"
          >
            {tNav("book")}
          </Link>
        </div>
      </div>
    </header>
  );
}
