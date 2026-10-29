"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabasePublicConfigured } from "@/lib/env";
import { Loader2 } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

type LinkState = "checking" | "valid" | "invalid";

export function ResetPasswordForm() {
  const t = useTranslations("AdminResetPassword");
  const locale = useLocale();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabasePublicConfigured) return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    // The browser client exchanges the recovery token in the URL for a
    // session on its own at startup; getSession() waits for that to finish.
    // No session afterwards means the link was already used, expired, or
    // opened in a different browser than the one that requested it.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLinkState(data.session ? "valid" : "invalid");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isSupabasePublicConfigured) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          {t("notConfigured")}
        </CardContent>
      </Card>
    );
  }

  if (linkState === "checking") {
    return (
      <Card>
        <CardContent className="flex justify-center pt-6">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (linkState === "invalid") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 text-center">
          <p className="font-medium">{t("invalidTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
          <Link href="/admin/forgot-password" className="text-sm underline">
            {t("requestNewLink")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("tooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(t("updateFailed"));
      setLoading(false);
      return;
    }

    // Hard navigation so the server sees the fresh session cookie.
    window.location.href = locale === "en" ? "/en/admin" : "/admin";
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
