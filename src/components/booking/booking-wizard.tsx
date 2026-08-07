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
import { Card, CardContent } from "@/components/ui/card";
import {
  SwissAddressFields,
  type SwissAddressValue,
} from "@/components/swiss-address-fields";
import { swissAddressSchema, clientContactSchema } from "@/lib/validation";
import { APP_TIMEZONE } from "@/lib/constants";
import { Loader2, CheckCircle2 } from "lucide-react";

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

function formatSlot(iso: string, locale: string) {
  const zoned = toZonedTime(new Date(iso), APP_TIMEZONE);
  return format(zoned, "EEEE d MMMM 'à' HH:mm", { locale: locale === "fr" ? fr : enUS });
}

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

  if (step === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="size-12 text-primary" />
          <h2 className="text-xl font-semibold">{t("confirmedTitle")}</h2>
          <p className="text-muted-foreground">{t("confirmedBody")}</p>
          {confirmedManageUrl && (
            <Button render={<Link href={confirmedManageUrl} />} nativeButton={false} variant="outline">
              {t("manageBookingLink")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-2 text-xs text-muted-foreground">
        <li className={step === "contact" ? "font-semibold text-foreground" : ""}>
          1. {t("stepContact")}
        </li>
        <span>·</span>
        <li className={step === "service" ? "font-semibold text-foreground" : ""}>
          2. {t("stepService")}
        </li>
        <span>·</span>
        <li className={step === "slots" ? "font-semibold text-foreground" : ""}>
          3. {t("stepSlots")}
        </li>
      </ol>

      {step === "contact" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
                {fieldErrors.phone && <p className="text-sm text-destructive">{fieldErrors.phone}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
              </div>
            </div>

            <SwissAddressFields value={address} onChange={setAddress} errors={fieldErrors} />

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button
              onClick={() => {
                if (validateContact()) setStep("service");
              }}
            >
              {t("next")}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "service" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="grid gap-2">
              {serviceTypes.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setServiceTypeId(st.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    serviceTypeId === st.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{locale === "fr" ? st.name_fr : st.name_en}</div>
                  <div className="text-sm text-muted-foreground">
                    ~{st.default_duration_minutes} min
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">{t("notesOptional")}</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("contact")}>
                {t("back")}
              </Button>
              <Button className="flex-1" disabled={!serviceTypeId || submitting} onClick={handleFindSlots}>
                {submitting ? <Loader2 className="animate-spin" /> : t("findSlots")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "slots" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            {slots.length === 0 ? (
              <p className="text-muted-foreground">{t("noSlots")}</p>
            ) : (
              <div className="grid gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startIso}
                    type="button"
                    onClick={() => setChosenStartIso(slot.startIso)}
                    className={`rounded-lg border p-3 text-left capitalize transition-colors ${
                      chosenStartIso === slot.startIso
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {formatSlot(slot.startIso, locale)}
                  </button>
                ))}
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("service")}>
                {t("back")}
              </Button>
              <Button
                className="flex-1"
                disabled={!chosenStartIso || submitting}
                onClick={handleConfirm}
              >
                {submitting ? <Loader2 className="animate-spin" /> : t("confirm")}
              </Button>
            </div>
          </CardContent>
        </Card>
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
