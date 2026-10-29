"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabasePublicConfigured } from "@/lib/env";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const t = useTranslations("AdminForgotPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabasePublicConfigured) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          {t("notConfigured")}
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // French is unprefixed, English lives under /en — the link in the email
    // must land on the same-language reset page.
    const prefix = locale === "en" ? "/en" : "";
    const redirectTo = `${window.location.origin}${prefix}/admin/reset-password`;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    // Supabase answers the same way whether or not the email has an account
    // (so this form can't be used to discover who's an admin). Only real
    // failures — rate limiting, email service down — surface as errors.
    if (error) {
      setError(t("sendFailed"));
      return;
    }
    setSent(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="font-medium">{t("sentTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("sentBody")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("intro")}</p>
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : t("submit")}
            </Button>
          </form>
        )}
        <div className="mt-4 text-center">
          <Link href="/admin/login" className="text-sm text-muted-foreground underline">
            {t("backToLogin")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
