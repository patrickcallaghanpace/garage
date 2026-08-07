"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { fromZonedTime } from "date-fns-tz";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SwissAddressFields,
  type SwissAddressValue,
} from "@/components/swiss-address-fields";
import { APP_TIMEZONE } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface ServiceTypeOption {
  id: string;
  name_fr: string;
  name_en: string;
  default_duration_minutes: number;
}

interface Impact {
  driveTimeInMinutes: number | null;
  driveTimeOutMinutes: number | null;
  marginalAddedMinutes: number | null;
}

export function NewBookingForm({
  serviceTypes,
  locale,
}: {
  serviceTypes: ServiceTypeOption[];
  locale: string;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<SwissAddressValue>({
    street: "",
    postalCode: "",
    locality: "",
    canton: "",
  });
  const [serviceTypeId, setServiceTypeId] = useState(serviceTypes[0]?.id ?? "");
  const [duration, setDuration] = useState(serviceTypes[0]?.default_duration_minutes ?? 30);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [impact, setImpact] = useState<Impact | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startIso(): string | null {
    if (!date || !time) return null;
    try {
      return fromZonedTime(`${date}T${time}:00`, APP_TIMEZONE).toISOString();
    } catch {
      return null;
    }
  }

  async function handlePreview() {
    const iso = startIso();
    if (!iso) {
      setError(t("errorPickDateTime"));
      return;
    }
    setPreviewing(true);
    setError(null);
    setImpact(null);
    try {
      const res = await fetch("/api/admin/appointments/preview-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTypeId, address, startIso: iso, durationMinutes: duration }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? t("errorGeneric"));
        return;
      }
      setImpact(json.impact);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit() {
    const iso = startIso();
    if (!iso) {
      setError(t("errorPickDateTime"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceTypeId,
          address,
          client: { name, phone, email, preferredLanguage: locale === "en" ? "en" : "fr" },
          startIso: iso,
          durationMinutes: duration,
          source: "phone",
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? t("errorGeneric"));
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="grid gap-1.5">
          <Label htmlFor="admin-name">{t("clientName")}</Label>
          <Input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-phone">{t("clientPhone")}</Label>
            <Input id="admin-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-email">{t("clientEmail")}</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <SwissAddressFields value={address} onChange={setAddress} idPrefix="admin-address" />

        <div className="grid gap-1.5">
          <Label>{t("serviceType")}</Label>
          <Select
            value={serviceTypeId}
            onValueChange={(v) => {
              if (!v) return;
              setServiceTypeId(v);
              const st = serviceTypes.find((s) => s.id === v);
              if (st) setDuration(st.default_duration_minutes);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((st) => (
                <SelectItem key={st.id} value={st.id}>
                  {locale === "fr" ? st.name_fr : st.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-date">{t("date")}</Label>
            <Input id="admin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-time">{t("time")}</Label>
            <Input id="admin-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-duration">{t("durationMinutes")}</Label>
            <Input
              id="admin-duration"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="admin-notes">{t("notesOptional")}</Label>
          <Textarea id="admin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button variant="outline" onClick={handlePreview} disabled={previewing}>
          {previewing ? <Loader2 className="animate-spin" /> : t("previewImpact")}
        </Button>

        {impact && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>{t("driveTimeIn", { minutes: impact.driveTimeInMinutes ?? "–" })}</p>
            {impact.driveTimeOutMinutes != null && (
              <p>{t("driveTimeOut", { minutes: impact.driveTimeOutMinutes })}</p>
            )}
            {impact.marginalAddedMinutes != null && (
              <p className="font-medium">
                {t("marginalAdded", { minutes: impact.marginalAddedMinutes })}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : t("confirmBooking")}
        </Button>
      </CardContent>
    </Card>
  );
}
