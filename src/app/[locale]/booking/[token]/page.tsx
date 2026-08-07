import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getBookingByToken } from "@/lib/services/scheduling";
import { ManageBookingView } from "@/components/booking/manage-booking-view";
import { SiteHeader } from "@/components/site-header";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ManageBooking");

  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-12">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <ManageBookingView token={token} initialBooking={booking} locale={locale} />
      </main>
    </div>
  );
}
