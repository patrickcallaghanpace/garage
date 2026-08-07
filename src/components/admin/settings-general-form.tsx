"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwissAddressFields, type SwissAddressValue } from "@/components/swiss-address-fields";
import type { AdminSettingsRow, WorkingHours } from "@/lib/types/database";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

function emptyAddress(): SwissAddressValue {
  return { street: "", postalCode: "", locality: "", canton: "" };
}

export function SettingsGeneralForm({ initialSettings }: { initialSettings: AdminSettingsRow }) {
  const t = useTranslations("Admin");
  const [saving, setSaving] = useState(false);

  const [homeAddress, setHomeAddress] = useState<SwissAddressValue>(
    initialSettings.home_address_street
      ? {
          street: initialSettings.home_address_street,
          postalCode: initialSettings.home_address_postal_code ?? "",
          locality: initialSettings.home_address_locality ?? "",
          canton: initialSettings.home_address_canton ?? "",
        }
      : emptyAddress()
  );
  const [workAddress, setWorkAddress] = useState<SwissAddressValue>(
    initialSettings.work_address_street
      ? {
          street: initialSettings.work_address_street,
          postalCode: initialSettings.work_address_postal_code ?? "",
          locality: initialSettings.work_address_locality ?? "",
          canton: initialSettings.work_address_canton ?? "",
        }
      : emptyAddress()
  );
  const [defaultAnchor, setDefaultAnchor] = useState(initialSettings.default_start_anchor);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialSettings.working_hours);
  const [lunchStart, setLunchStart] = useState(initialSettings.lunch_break_start.slice(0, 5));
  const [lunchEnd, setLunchEnd] = useState(initialSettings.lunch_break_end.slice(0, 5));
  const [hardRadius, setHardRadius] = useState(initialSettings.hard_radius_minutes);
  const [efficiencyEnabled, setEfficiencyEnabled] = useState(initialSettings.efficiency_cap_enabled);
  const [efficiencyMinutes, setEfficiencyMinutes] = useState(
    initialSettings.efficiency_cap_minutes ?? 15
  );
  const [adminEmail, setAdminEmail] = useState(initialSettings.notification_prefs.admin_email ?? "");
  const [adminWhatsapp, setAdminWhatsapp] = useState(
    initialSettings.notification_prefs.admin_whatsapp_number ?? ""
  );
  const [emailEnabled, setEmailEnabled] = useState(initialSettings.notification_prefs.email_enabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    initialSettings.notification_prefs.whatsapp_enabled
  );

  function updateDay(day: (typeof WEEKDAYS)[number], patch: Partial<WorkingHours[typeof day]>) {
    setWorkingHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeAddress: homeAddress.street ? homeAddress : null,
          workAddress: workAddress.street ? workAddress : null,
          defaultStartAnchor: defaultAnchor,
          workingHours,
          lunchBreakStart: lunchStart,
          lunchBreakEnd: lunchEnd,
          hardRadiusMinutes: hardRadius,
          efficiencyCapEnabled: efficiencyEnabled,
          efficiencyCapMinutes: efficiencyEnabled ? efficiencyMinutes : null,
          notificationPrefs: {
            email_enabled: emailEnabled,
            whatsapp_enabled: whatsappEnabled,
            admin_email: adminEmail || null,
            admin_whatsapp_number: adminWhatsapp || null,
          },
        }),
      });
      if (!res.ok) {
        toast.error(t("errorGeneric"));
        return;
      }
      toast.success(t("settingsSaved"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-medium">{t("homeAddress")}</h2>
          <SwissAddressFields value={homeAddress} onChange={setHomeAddress} idPrefix="home" />
          <Separator />
          <h2 className="font-medium">{t("workAddress")}</h2>
          <SwissAddressFields value={workAddress} onChange={setWorkAddress} idPrefix="work" />
          <Separator />
          <div className="grid gap-1.5">
            <Label>{t("defaultStartAnchor")}</Label>
            <Select value={defaultAnchor} onValueChange={(v) => v && setDefaultAnchor(v as "home" | "work")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{t("home")}</SelectItem>
                <SelectItem value="work">{t("work")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <h2 className="font-medium">{t("workingHours")}</h2>
          {WEEKDAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <label className="flex w-24 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={workingHours[day].open}
                  onChange={(e) => updateDay(day, { open: e.target.checked })}
                />
                {t(`weekday.${day}`)}
              </label>
              <Input
                type="time"
                className="w-28"
                disabled={!workingHours[day].open}
                value={workingHours[day].start ?? "08:00"}
                onChange={(e) => updateDay(day, { start: e.target.value })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                className="w-28"
                disabled={!workingHours[day].open}
                value={workingHours[day].end ?? "18:00"}
                onChange={(e) => updateDay(day, { end: e.target.value })}
              />
            </div>
          ))}
          <Separator />
          <h2 className="font-medium">{t("lunchBreak")}</h2>
          <div className="flex items-center gap-3">
            <Input type="time" className="w-28" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} />
            <span className="text-muted-foreground">–</span>
            <Input type="time" className="w-28" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="hard-radius">{t("hardRadiusMinutes")}</Label>
            <Input
              id="hard-radius"
              type="number"
              min={1}
              value={hardRadius}
              onChange={(e) => setHardRadius(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{t("hardRadiusHelp")}</p>
          </div>
          <Separator />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={efficiencyEnabled}
              onChange={(e) => setEfficiencyEnabled(e.target.checked)}
            />
            {t("efficiencyCapEnabled")}
          </label>
          {efficiencyEnabled && (
            <div className="grid gap-1.5">
              <Label htmlFor="efficiency-minutes">{t("efficiencyCapMinutes")}</Label>
              <Input
                id="efficiency-minutes"
                type="number"
                min={1}
                value={efficiencyMinutes}
                onChange={(e) => setEfficiencyMinutes(Number(e.target.value))}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("efficiencyCapHelp")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-medium">{t("notifications")}</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-alert-email">{t("adminAlertEmail")}</Label>
            <Input
              id="admin-alert-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-alert-whatsapp">{t("adminAlertWhatsapp")}</Label>
            <Input
              id="admin-alert-whatsapp"
              value={adminWhatsapp}
              onChange={(e) => setAdminWhatsapp(e.target.value)}
              placeholder="+41 79 123 45 67"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
            {t("emailNotificationsEnabled")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
            />
            {t("whatsappNotificationsEnabled")}
          </label>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : t("save")}
      </Button>
    </div>
  );
}
