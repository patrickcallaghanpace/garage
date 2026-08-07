import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SettingsView } from "@/components/admin/settings-view";

async function getData() {
  const supabase = getSupabaseAdmin();
  const [{ data: settings }, { data: serviceTypes }, { data: overrides }] = await Promise.all([
    supabase.from("admin_settings").select("*").eq("id", 1).single(),
    supabase.from("service_types").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("daily_overrides")
      .select("*")
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true }),
  ]);
  return { settings, serviceTypes: serviceTypes ?? [], overrides: overrides ?? [] };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const { settings, serviceTypes, overrides } = await getData();

  if (!settings) {
    return <p className="text-muted-foreground">{t("errorGeneric")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("settingsTitle")}</h1>
      <SettingsView
        initialSettings={settings}
        initialServiceTypes={serviceTypes}
        initialOverrides={overrides}
        locale={locale}
      />
    </div>
  );
}
