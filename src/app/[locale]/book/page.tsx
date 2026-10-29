import { getTranslations, setRequestLocale } from "next-intl/server";
import { isGoogleMapsConfigured, isSupabaseConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { BookingWizard, type ServiceTypeOption } from "@/components/booking/booking-wizard";
import { SiteHeader } from "@/components/site-header";

async function getServiceTypes(): Promise<ServiceTypeOption[] | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("service_types")
      .select("id, name_fr, name_en, default_duration_minutes")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("Failed to load service types for /book:", err);
    return null;
  }
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");

  const serviceTypes = isSupabaseConfigured && isGoogleMapsConfigured ? await getServiceTypes() : null;

  if (!serviceTypes) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">{t("unavailableTitle")}</h1>
          <p className="text-muted-foreground">{t("unavailableBody")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-12">
        <h1 className="display mb-6 text-5xl sm:text-6xl">{t("title")}</h1>
        <BookingWizard serviceTypes={serviceTypes} locale={locale} />
      </main>
    </div>
  );
}
