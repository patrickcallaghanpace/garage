"use client";

import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SWISS_CANTONS } from "@/lib/cantons";

export interface SwissAddressValue {
  street: string;
  postalCode: string;
  locality: string;
  canton: string;
}

export interface SwissAddressFieldsProps {
  value: SwissAddressValue;
  onChange: (value: SwissAddressValue) => void;
  errors?: Partial<Record<keyof SwissAddressValue, string>>;
  idPrefix?: string;
}

export function SwissAddressFields({
  value,
  onChange,
  errors,
  idPrefix = "address",
}: SwissAddressFieldsProps) {
  const t = useTranslations("Address");
  const locale = useLocale();

  function set<K extends keyof SwissAddressValue>(key: K, v: SwissAddressValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-street`}>{t("street")}</Label>
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          onChange={(e) => set("street", e.target.value)}
          placeholder={t("streetPlaceholder")}
          autoComplete="street-address"
        />
        {errors?.street && <p className="text-sm text-destructive">{errors.street}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-postal`}>{t("postalCode")}</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={value.postalCode}
            onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1000"
            inputMode="numeric"
            autoComplete="postal-code"
          />
          {errors?.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-locality`}>{t("locality")}</Label>
          <Input
            id={`${idPrefix}-locality`}
            value={value.locality}
            onChange={(e) => set("locality", e.target.value)}
            placeholder={t("localityPlaceholder")}
            autoComplete="address-level2"
          />
          {errors?.locality && <p className="text-sm text-destructive">{errors.locality}</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-canton`}>{t("canton")}</Label>
        <Select value={value.canton} onValueChange={(v) => set("canton", v ?? "")}>
          <SelectTrigger id={`${idPrefix}-canton`} className="w-full">
            <SelectValue placeholder={t("cantonPlaceholder")}>
              {(code: string) => {
                const canton = SWISS_CANTONS.find((c) => c.code === code);
                if (!canton) return t("cantonPlaceholder");
                return `${locale === "fr" ? canton.nameFr : canton.nameEn} (${canton.code})`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SWISS_CANTONS.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {locale === "fr" ? c.nameFr : c.nameEn} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.canton && <p className="text-sm text-destructive">{errors.canton}</p>}
      </div>
    </div>
  );
}
