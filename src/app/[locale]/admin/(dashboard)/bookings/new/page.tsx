import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NewBookingForm } from "@/components/admin/new-booking-form";

async function getServiceTypes() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("service_types")
    .select("id, name_fr, name_en, default_duration_minutes")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export default async function NewBookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");
  const serviceTypes = await getServiceTypes();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("newBookingTitle")}</h1>
      <NewBookingForm serviceTypes={serviceTypes} locale={locale} />
    </div>
  );
}
