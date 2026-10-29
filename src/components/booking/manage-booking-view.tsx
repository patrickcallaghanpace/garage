"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_TIMEZONE } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import type { BookingDetails } from "@/lib/services/scheduling";

interface SlotOption {
  date: string;
  startIso: string;
  endIso: string;
  marginalAddedMinutes: number;
}

function formatWhen(iso: string, locale: string) {
  const zoned = toZonedTime(new Date(iso), APP_TIMEZONE);
  const at = locale === "fr" ? "à" : "at";
  return format(zoned, `EEEE d MMMM yyyy '${at}' HH:mm`, { locale: locale === "fr" ? fr : enUS });
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
};

export function ManageBookingView({
  token,
  initialBooking,
  locale,
}: {
  token: string;
  initialBooking: BookingDetails;
  locale: string;
}) {
  const t = useTranslations("ManageBooking");
  const [booking, setBooking] = useState(initialBooking);
  const [mode, setMode] = useState<"idle" | "reschedule" | "cancel">("idle");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { appointment, serviceType } = booking;
  const serviceName = locale === "fr" ? serviceType.name_fr : serviceType.name_en;
  const canAct = appointment.status === "pending" || appointment.status === "confirmed";

  async function startReschedule() {
    setMode("reschedule");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/reschedule`);
      const json = await res.json();
      if (!res.ok) {
        setError(t("errorGeneric"));
        return;
      }
      setSlots(json.slots);
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReschedule(startIso: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosenStartIso: startIso }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(t("errorSlotUnavailable"));
        return;
      }
      setBooking({ ...booking, appointment: json.appointment });
      setMode("idle");
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}/cancel`, { method: "POST" });
      if (!res.ok) {
        setError(t("errorGeneric"));
        return;
      }
      setBooking({ ...booking, appointment: { ...appointment, status: "cancelled" } });
      setMode("idle");
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center justify-between">
            <span className="font-medium">{serviceName}</span>
            <Badge variant={STATUS_VARIANT[appointment.status]}>{t(`status.${appointment.status}`)}</Badge>
          </div>
          <p className="text-xl font-semibold first-letter:uppercase">{formatWhen(appointment.scheduled_start, locale)}</p>
          <p className="text-sm text-muted-foreground">
            {appointment.address_street}, {appointment.address_postal_code}{" "}
            {appointment.address_locality}
          </p>
        </CardContent>
      </Card>

      {canAct && mode === "idle" && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={startReschedule}>
            {t("reschedule")}
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => setMode("cancel")}>
            {t("cancel")}
          </Button>
        </div>
      )}

      {mode === "reschedule" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-medium">{t("chooseNewTime")}</h2>
            {loading && <Loader2 className="animate-spin" />}
            {!loading && slots.length === 0 && <p className="text-muted-foreground">{t("noSlots")}</p>}
            <div className="grid gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.startIso}
                  type="button"
                  disabled={loading}
                  onClick={() => confirmReschedule(slot.startIso)}
                  className="min-h-12 border-2 border-ink/15 p-3 text-left font-semibold transition-colors first-letter:uppercase hover:border-ink"
                >
                  {formatWhen(slot.startIso, locale)}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="outline" onClick={() => setMode("idle")}>
              {t("back")}
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "cancel" && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p>{t("confirmCancelPrompt")}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode("idle")} disabled={loading}>
                {t("back")}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmCancel} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : t("confirmCancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
