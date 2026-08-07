"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { ServiceTypeRow } from "@/lib/types/database";
import { toast } from "sonner";

export function SettingsServiceTypes({
  initialServiceTypes,
  locale,
}: {
  initialServiceTypes: ServiceTypeRow[];
  locale: string;
}) {
  const t = useTranslations("Admin");
  const [serviceTypes, setServiceTypes] = useState(initialServiceTypes);

  async function patchServiceType(id: string, patch: Record<string, unknown>) {
    setServiceTypes((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...("active" in patch ? { active: patch.active as boolean } : {}),
              ...("defaultDurationMinutes" in patch
                ? { default_duration_minutes: patch.defaultDurationMinutes as number }
                : {}),
            }
          : s
      )
    );
    const res = await fetch(`/api/admin/service-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) toast.error(t("errorGeneric"));
  }

  return (
    <div className="flex flex-col gap-2 pt-4">
      {serviceTypes.map((st) => (
        <Card key={st.id}>
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{locale === "fr" ? st.name_fr : st.name_en}</span>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={st.active}
                  onChange={(e) => patchServiceType(st.id, { active: e.target.checked })}
                />
                {t("active")}
              </label>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                className="w-20"
                min={5}
                step={5}
                value={st.default_duration_minutes}
                onChange={(e) =>
                  patchServiceType(st.id, { defaultDurationMinutes: Number(e.target.value) })
                }
              />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
