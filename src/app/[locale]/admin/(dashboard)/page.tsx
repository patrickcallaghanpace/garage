import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminCalendar } from "@/components/admin/admin-calendar";

export default async function AdminHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">{t("calendarTitle")}</h1>
      <AdminCalendar locale={locale} />
    </div>
  );
}
