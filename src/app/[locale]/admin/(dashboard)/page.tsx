import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { SetupBanner } from "@/components/admin/setup-banner";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

async function isAnchorConfigured(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select("default_start_anchor, home_lat, home_lng, work_lat, work_lng")
    .eq("id", 1)
    .single();
  if (!data) return false;
  return data.default_start_anchor === "home"
    ? data.home_lat != null && data.home_lng != null
    : data.work_lat != null && data.work_lng != null;
}

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const configured = await isAnchorConfigured();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("calendarTitle")}</h1>
      {!configured && <SetupBanner />}
      <AdminCalendar locale={locale} />
    </div>
  );
}
