"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsGeneralForm } from "@/components/admin/settings-general-form";
import { SettingsServiceTypes } from "@/components/admin/settings-service-types";
import { SettingsOverrides } from "@/components/admin/settings-overrides";
import type { AdminSettingsRow, DailyOverrideRow, ServiceTypeRow } from "@/lib/types/database";

export function SettingsView({
  initialSettings,
  initialServiceTypes,
  initialOverrides,
  locale,
}: {
  initialSettings: AdminSettingsRow;
  initialServiceTypes: ServiceTypeRow[];
  initialOverrides: DailyOverrideRow[];
  locale: string;
}) {
  const t = useTranslations("Admin");

  return (
    <Tabs defaultValue="general">
      <TabsList className="w-full">
        <TabsTrigger value="general" className="flex-1">
          {t("tabGeneral")}
        </TabsTrigger>
        <TabsTrigger value="services" className="flex-1">
          {t("tabServices")}
        </TabsTrigger>
        <TabsTrigger value="overrides" className="flex-1">
          {t("tabOverrides")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <SettingsGeneralForm initialSettings={initialSettings} />
      </TabsContent>
      <TabsContent value="services">
        <SettingsServiceTypes initialServiceTypes={initialServiceTypes} locale={locale} />
      </TabsContent>
      <TabsContent value="overrides">
        <SettingsOverrides initialOverrides={initialOverrides} />
      </TabsContent>
    </Tabs>
  );
}
