import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export async function SetupBanner() {
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">{t("setupBannerTitle")}</p>
          <p className="text-sm opacity-90">{t("setupBannerBody")}</p>
        </div>
      </div>
      <Button
        render={<Link href="/admin/settings" />}
        nativeButton={false}
        size="sm"
        className="self-start"
      >
        {t("setupBannerCta")}
      </Button>
    </div>
  );
}
