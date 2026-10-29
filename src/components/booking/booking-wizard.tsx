"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SwissAddressFields,
  type SwissAddressValue,
} from "@/components/swiss-address-fields";
import { swissAddressSchema, clientContactSchema } from "@/lib/validation";
import { APP_TIMEZONE } from "@/lib/constants";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServiceTypeOption {
  id: string;
  name_fr: string;
  name_en: string;
  default_duration_minutes: number;
}

interface SlotOption {
  date: string;
  startIso: string;
  endIso: string;
  marginalAddedMinutes: number;
}

type Step = "contact" | "service" | "slots" | "done";

function slotParts(iso: string, locale: string) {
  const zoned = toZonedTime(new Date(iso), APP_TIMEZONE);
  const dateLocale = locale === "fr" ? fr : enUS;
  return {
    day: format(zoned, "EEEE d MMMM", { locale: dateLocale }),
    time: format(zoned, "HH:mm"),
  };
}

const primaryBtn = "h-12 text-base font-bold uppercase tracking-wide";
const panel = "border-2 border-ink bg-white p-5 sm:p-8";

export function BookingWizard({
  serviceTypes,
  locale,
}: {
  serviceTypes: ServiceTypeOption[];
  locale: string;
}) {
  const t = useTranslations("Booking");

  const [step, setStep] = useState<Step>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<SwissAddressValue>({
    street: "",
    postalCode: "",
    locality: "",
    canton: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [serviceTypeId, setServiceTypeId] = useState<string>(serviceTypes[0]?.id ?? "");
  const [notes, setNotes] = useState("");

  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [chosenStartIso, setChosenStartIso] = useState<string | null>(null);
  const [confirmedManageUrl, setConfirmedManageUrl] = useState<string | null>(null);

  function validateContact(): boolean {
    const contactResult = clientContactSchema.safeParse({
      name,
      phone,
      email,
      preferredLanguage: locale === "en" ? "en" : "fr",
    });
    const addressResult = swissAddressSchema.safeParse(address);

    const errors: Record<string, string> = {};
    if (!contactResult.success) {
      for (const issue of contactResult.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
    }
    if (!addressResult.success) {
      for (const issue of addressResult.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleFindSlots() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/booking/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTypeId, address }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(mapApiError(json.error, t));
        return;
      }
      setSlots(json.slots);
      setStep("slots");
    } catch {
      setFormError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!chosenStartIso) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceTypeId,
          address,
          client: { name, phone, email, preferredLanguage: locale === "en" ? "en" : "fr" },
          chosenStartIso,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(mapApiError(json.error, t));
        if (json.error === "slot_unavailable") {
          setStep("slots");
          setSlots([]);
          setChosenStartIso(null);
        }
        return;
      }
      const prefix = locale === "en" ? "/en" : "";
      setConfirmedManageUrl(`${prefix}/booking/${json.appointment.reschedule_cancel_token}`);
      setStep("done");
    } catch {
      setFormError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  const chosenSlot = slots.find((sl) => sl.startIso === chosenStartIso) ?? null;
  const chosenService = serviceTypes.find((st) => st.id === serviceTypeId);
  const serviceName = chosenService
    ? locale === "fr"
      ? chosenService.name_fr
      : chosenService.name_en
    : "";

  if (step === "done") {
    const when = chosenSlot ? slotParts(chosenSlot.startIso, locale) : null;
    return (
      <div className={cn(panel, "flex flex-col gap-6")}>
        <div className="flex size-12 items-center justify-center bg-signal text-signal-foreground">
          <Check className="size-7" strokeWidth={3} />
        </div>
        <h2 className="display text-4xl sm:text-5xl">{t("confirmedTitle")}</h2>
        {when && (
          <dl className="grid gap-3 border-y border-ink/20 py-4 text-base">
            <div>
              <dt className="text-sm text-muted-foreground">{t("summaryWhen")}</dt>
              <dd className="text-lg font-semibold first-letter:uppercase">
                {when.day}, {when.time}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t("summaryService")}</dt>
              <dd className="text-lg font-semibold">{serviceName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t("summaryWhere")}</dt>
              <dd className="text-lg font-semibold">
                {address.street}, {address.postalCode} {address.locality}
              </dd>
            </div>
          </dl>
        )}
        <p className="text-muted-foreground">{t("confirmedBody")}</p>
        {confirmedManageUrl && (
          <Button
            render={<Link href={confirmedManageUrl} />}
            nativeButton={false}
            variant="outline"
            className={cn(primaryBtn, "self-start border-2 border-ink px-6")}
          >
            {t("manageBookingLink")}
          </Button>
        )}
      </div>
    );
  }

  const stepIndex = step === "contact" ? 0 : step === "service" ? 1 : 2;
  const stepLabels = [t("stepContact"), t("stepService"), t("stepSlots")];

  // Slots grouped by day, in the order the engine ranked them.
  const slotGroups: { day: string; items: (SlotOption & { time: string })[] }[] = [];
  for (const sl of slots) {
    const { day, time } = slotParts(sl.startIso, locale);
    const group = slotGroups.find((g) => g.day === day);
    if (group) group.items.push({ ...sl, time });
    else slotGroups.push({ day, items: [{ ...sl, time }] });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
        {stepLabels.map((label, i) => (
          <li key={label} aria-current={i === stepIndex ? "step" : undefined}>
            <div className={cn("h-1.5", i <= stepIndex ? "bg-ink" : "bg-ink/15")} />
            <span
              className={cn(
                "mt-2 block text-sm sm:text-base",
                i === stepIndex ? "font-bold" : "text-muted-foreground"
              )}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {step === "contact" && (
        <div className={cn(panel, "flex flex-col gap-5")}>
          <div className="grid gap-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" className="h-12 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
              {fieldErrors.phone && <p className="text-sm text-destructive">{fieldErrors.phone}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" className="h-12 text-base" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
            </div>
          </div>

          <SwissAddressFields value={address} onChange={setAddress} errors={fieldErrors} />

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button
            className={primaryBtn}
            onClick={() => {
              if (validateContact()) setStep("service");
            }}
          >
            {t("next")}
          </Button>
        </div>
      )}

      {step === "service" && (
        <div className={cn(panel, "flex flex-col gap-6")}>
          <div role="radiogroup" aria-label={t("stepService")} className="grid gap-2">
            {serviceTypes.map((st) => {
              const selected = serviceTypeId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setServiceTypeId(st.id)}
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-4 border-2 px-4 py-3 text-left transition-colors",
                    selected ? "border-ink bg-ink text-white" : "border-ink/15 hover:border-ink"
                  )}
                >
                  <span className="text-lg font-semibold">{locale === "fr" ? st.name_fr : st.name_en}</span>
                  <span className={cn("shrink-0 text-sm", selected ? "text-white/75" : "text-muted-foreground")}>
                    ~{st.default_duration_minutes} min
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">{t("notesOptional")}</Label>
            <Textarea id="notes" className="text-base" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-3">
            <Button variant="outline" className={cn(primaryBtn, "border-2 border-ink")} onClick={() => setStep("contact")}>
              {t("back")}
            </Button>
            <Button className={cn(primaryBtn, "flex-1")} disabled={!serviceTypeId || submitting} onClick={handleFindSlots}>
              {submitting ? <Loader2 className="animate-spin" /> : t("findSlots")}
            </Button>
          </div>
        </div>
      )}

      {step === "slots" && (
        <div className={cn(panel, "flex flex-col gap-6")}>
          {slots.length === 0 ? (
            <p className="text-lg text-muted-foreground">{t("noSlots")}</p>
          ) : (
            <div role="radiogroup" aria-label={t("stepSlots")} className="flex flex-col gap-5">
              {slotGroups.map((group) => (
                <div key={group.day}>
                  <h3 className="display text-2xl first-letter:uppercase">{group.day}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.items.map((sl) => {
                      const selected = chosenStartIso === sl.startIso;
                      return (
                        <button
                          key={sl.startIso}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setChosenStartIso(sl.startIso)}
                          className={cn(
                            "flex min-h-12 min-w-24 items-center justify-center border-2 px-5 text-lg font-bold tabular-nums transition-colors",
                            selected
                              ? "border-ink bg-signal text-signal-foreground"
                              : "border-ink/15 hover:border-ink"
                          )}
                        >
                          {sl.time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-3">
            <Button variant="outline" className={cn(primaryBtn, "border-2 border-ink")} onClick={() => setStep("service")}>
              {t("back")}
            </Button>
            <Button className={cn(primaryBtn, "flex-1")} disabled={!chosenStartIso || submitting} onClick={handleConfirm}>
              {submitting ? <Loader2 className="animate-spin" /> : t("confirm")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function mapApiError(code: string | undefined, t: ReturnType<typeof useTranslations>): string {
  switch (code) {
    case "address_not_geocodable":
      return t("errorAddressNotFound");
    case "slot_unavailable":
      return t("errorSlotUnavailable");
    case "not_configured":
      return t("errorNotConfigured");
    case "validation_error":
      return t("errorValidation");
    default:
      return t("errorGeneric");
  }
}
