"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DailyOverrideRow } from "@/lib/types/database";
import { Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

type AnchorType = "home" | "work" | "current_location";

export function SettingsOverrides({ initialOverrides }: { initialOverrides: DailyOverrideRow[] }) {
  const t = useTranslations("Admin");
  const [overrides, setOverrides] = useState(initialOverrides);
  const [date, setDate] = useState("");
  const [anchorType, setAnchorType] = useState<AnchorType>("home");
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomLat(pos.coords.latitude);
        setCustomLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        toast.error(t("errorGeneric"));
        setLocating(false);
      }
    );
  }

  async function handleAdd() {
    if (!date) return;
    if (anchorType === "current_location" && (customLat == null || customLng == null)) {
      toast.error(t("overridesNeedLocation"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/daily-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startAnchorType: anchorType,
          customLat: customLat ?? undefined,
          customLng: customLng ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(t("errorGeneric"));
        return;
      }
      setOverrides((prev) => [...prev.filter((o) => o.date !== date), json.override].sort((a, b) =>
        a.date.localeCompare(b.date)
      ));
      setDate("");
      setCustomLat(null);
      setCustomLng(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(overrideDate: string) {
    const res = await fetch(`/api/admin/daily-overrides/${overrideDate}`, { method: "DELETE" });
    if (res.ok) setOverrides((prev) => prev.filter((o) => o.date !== overrideDate));
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-medium">{t("addOverride")}</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="override-date">{t("date")}</Label>
            <Input id="override-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("startAnchorType")}</Label>
            <Select value={anchorType} onValueChange={(v) => v && setAnchorType(v as AnchorType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{t("home")}</SelectItem>
                <SelectItem value="work">{t("work")}</SelectItem>
                <SelectItem value="current_location">{t("currentLocation")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {anchorType === "current_location" && (
            <Button variant="outline" onClick={useCurrentLocation} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <MapPin />}
              {customLat != null ? t("locationCaptured") : t("captureLocation")}
            </Button>
          )}
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : t("addOverride")}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {overrides.map((o) => (
          <Card key={o.date}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{o.date}</div>
                <div className="text-sm text-muted-foreground">{t(`anchorType.${o.start_anchor_type}`)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(o.date)}>
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {overrides.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">{t("noOverrides")}</p>
        )}
      </div>
    </div>
  );
}
