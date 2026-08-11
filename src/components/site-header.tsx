import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { env } from "@/lib/env";

export async function SiteHeader() {
  const t = await getTranslations("App");
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <Link href="/" className="font-semibold tracking-tight">
        {env.businessName ?? t("name")}
      </Link>
      <LocaleSwitcher />
    </header>
  );
}
