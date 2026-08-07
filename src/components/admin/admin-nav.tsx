"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { CalendarDays, Plus, Settings, LogOut } from "lucide-react";

function useIsActive(href: string) {
  const pathname = usePathname();
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof CalendarDays }) {
  const active = useIsActive(href);
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

export function AdminNav() {
  const t = useTranslations("Admin");

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    // Hard navigation on purpose: guarantees no stale authenticated RSC
    // payload is reused after the session cookie is cleared.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login";
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <NavLink href="/admin" label={t("navCalendar")} icon={CalendarDays} />
      <NavLink href="/admin/bookings/new" label={t("navNewBooking")} icon={Plus} />
      <NavLink href="/admin/settings" label={t("navSettings")} icon={Settings} />
      <button
        type="button"
        onClick={handleSignOut}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
      >
        <LogOut className="size-5" />
        {t("navSignOut")}
      </button>
    </nav>
  );
}
