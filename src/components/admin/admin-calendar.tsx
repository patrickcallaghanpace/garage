"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toZonedTime } from "date-fns-tz";
import { format, addDays } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { APP_TIMEZONE } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Loader2, Phone } from "lucide-react";

interface AdminAppointment {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  payment_status: string;
  source: string;
  notes: string | null;
  address_street: string;
  address_postal_code: string;
  address_locality: string;
  clients: { id: string; name: string; phone: string; email: string };
  service_types: { id: string; name_fr: string; name_en: string };
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
};

const PAYMENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  unpaid: "destructive",
  paid_onsite: "default",
  paid_online: "default",
};

function todayZurichStr() {
  return format(toZonedTime(new Date(), APP_TIMEZONE), "yyyy-MM-dd");
}

export function AdminCalendar({ locale }: { locale: string }) {
  const t = useTranslations("Admin");
  const [dateStr, setDateStr] = useState(todayZurichStr());
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminAppointment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const dateLocale = locale === "fr" ? fr : enUS;
  const displayDate = format(toZonedTime(new Date(`${dateStr}T12:00:00Z`), APP_TIMEZONE), "EEEE d MMMM yyyy", {
    locale: dateLocale,
  });

  const load = useCallback(async () => {
    try {
      const nextDay = format(addDays(new Date(`${dateStr}T12:00:00Z`), 1), "yyyy-MM-dd");
      const res = await fetch(`/api/admin/appointments?from=${dateStr}&to=${nextDay}`);
      const json = await res.json();
      if (res.ok) setAppointments(json.appointments);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

  function goToDate(next: string) {
    setLoading(true);
    setDateStr(next);
  }

  function shiftDay(delta: number) {
    goToDate(format(addDays(new Date(`${dateStr}T12:00:00Z`), delta), "yyyy-MM-dd"));
  }

  async function updateAppointment(patch: Record<string, unknown>) {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/appointments/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setSelected(null);
        await load();
      }
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
          <ChevronLeft />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-medium capitalize">{displayDate}</span>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => goToDate(todayZurichStr())}
          >
            {t("today")}
          </button>
        </div>
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)}>
          <ChevronRight />
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {!loading && appointments.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">{t("noAppointments")}</p>
      )}

      <div className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <button key={appt.id} type="button" onClick={() => setSelected(appt)} className="text-left">
            <Card className="transition-colors hover:bg-muted">
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {format(toZonedTime(new Date(appt.scheduled_start), APP_TIMEZONE), "HH:mm")}–
                    {format(toZonedTime(new Date(appt.scheduled_end), APP_TIMEZONE), "HH:mm")}
                  </div>
                  <div className="text-sm">{appt.clients.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {locale === "fr" ? appt.service_types.name_fr : appt.service_types.name_en}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={STATUS_VARIANT[appt.status]}>{t(`status.${appt.status}`)}</Badge>
                  <Badge variant={PAYMENT_VARIANT[appt.payment_status]}>
                    {t(`payment.${appt.payment_status}`)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.clients.name}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  {format(toZonedTime(new Date(selected.scheduled_start), APP_TIMEZONE), "EEEE d MMMM HH:mm", {
                    locale: dateLocale,
                  })}
                  {" – "}
                  {format(toZonedTime(new Date(selected.scheduled_end), APP_TIMEZONE), "HH:mm")}
                </p>
                <p className="text-muted-foreground">
                  {locale === "fr" ? selected.service_types.name_fr : selected.service_types.name_en}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="size-3.5" /> {selected.clients.phone}
                </p>
                <p className="text-muted-foreground">
                  {selected.address_street}, {selected.address_postal_code} {selected.address_locality}
                </p>
                {selected.notes && <p className="italic text-muted-foreground">{selected.notes}</p>}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {selected.payment_status !== "paid_onsite" && (
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => updateAppointment({ paymentStatus: "paid_onsite" })}
                  >
                    {t("markPaid")}
                  </Button>
                )}
                {selected.payment_status === "paid_onsite" && (
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => updateAppointment({ paymentStatus: "unpaid" })}
                  >
                    {t("markUnpaid")}
                  </Button>
                )}
                {selected.status !== "cancelled" && (
                  <Button
                    variant="destructive"
                    disabled={actionLoading}
                    onClick={() => updateAppointment({ status: "cancelled" })}
                  >
                    {t("cancelAppointment")}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
