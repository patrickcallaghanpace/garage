import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@/lib/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ArrowRight } from "lucide-react";

// Service list comes from the database (so admin toggles show up); refresh every 5 min.
export const revalidate = 300;

interface ServiceItem {
  id: string;
  name_fr: string;
  name_en: string;
  default_duration_minutes: number;
}

async function getServices(): Promise<ServiceItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("service_types")
      .select("id, name_fr, name_en, default_duration_minutes")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("Failed to load services for home page:", err);
    return [];
  }
}

const STEP_KEYS = ["where", "service", "slot", "arrive"] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const services = await getServices();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero — drenched in the livery black, trailer photo as the proof */}
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-10 sm:px-8 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pb-20">
            <div>
              <h1
                className="display rise text-[clamp(3.25rem,11vw,6rem)]"
                style={{ ["--d" as string]: "0ms" }}
              >
                {t("heroTitle")}
              </h1>
              <p
                className="rise mt-6 max-w-[34ch] text-lg leading-relaxed text-white/80 sm:text-xl"
                style={{ ["--d" as string]: "120ms" }}
              >
                {t("heroSubtitle")}
              </p>
              <div
                className="rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
                style={{ ["--d" as string]: "240ms" }}
              >
                <Link
                  href="/book"
                  className="group inline-flex min-h-14 items-center gap-3 bg-signal px-7 text-lg font-bold uppercase tracking-wide text-signal-foreground transition-transform hover:-translate-y-0.5"
                >
                  {t("cta")}
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <a href={brand.phoneHref} className="text-base text-white/80 underline-offset-4 hover:underline">
                  {t("orCall")} <span className="font-semibold text-white">{brand.phoneDisplay}</span>
                </a>
              </div>
            </div>

            <div className="rise relative" style={{ ["--d" as string]: "200ms" }}>
              <Image
                src={brand.trailerPhoto}
                alt={t("photoAlt")}
                width={1440}
                height={1080}
                priority
                sizes="(min-width: 1024px) 520px, 100vw"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        </section>

        <div className="tread" aria-hidden />

        {/* How it works — a real sequence, so numbering is honest here */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
          <h2 className="display text-[clamp(2.25rem,6vw,3.75rem)]">{t("howTitle")}</h2>
          <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="border-t-2 border-ink pt-4">
                <span className="display block text-5xl text-ink/25" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-2 text-xl font-bold leading-snug">{t(`steps.${key}.title`)}</h3>
                <p className="mt-1.5 max-w-[30ch] text-base leading-relaxed text-muted-foreground">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {services.length > 0 && (
          <section className="bg-secondary">
            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:py-24 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <h2 className="display text-[clamp(2.25rem,6vw,3.75rem)]">{t("servicesTitle")}</h2>
                <p className="mt-4 max-w-[32ch] text-lg leading-relaxed text-muted-foreground">
                  {t("servicesBody")}
                </p>
              </div>
              <ul className="border-t-2 border-ink">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-baseline justify-between gap-4 border-b border-ink/20 py-4"
                  >
                    <span className="text-xl font-semibold sm:text-2xl">
                      {locale === "fr" ? s.name_fr : s.name_en}
                    </span>
                    <span className="shrink-0 text-base text-muted-foreground">
                      ~{s.default_duration_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Closing call to action */}
        <section className="bg-signal text-signal-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:px-8 md:flex-row md:items-center">
            <h2 className="display text-[clamp(2.25rem,6vw,3.75rem)]">{t("closingTitle")}</h2>
            <Link
              href="/book"
              className="group inline-flex min-h-14 items-center gap-3 bg-ink px-7 text-lg font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
            >
              {t("cta")}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
