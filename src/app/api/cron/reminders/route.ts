import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBookingNotifications } from "@/lib/services/notifications";
import { addCalendarDays, zonedNow, zurichDateString, zurichWallTimeToUtc } from "@/lib/time";

/**
 * Daily reminder job — meant to be triggered by Vercel Cron (see vercel.json)
 * once a day in the evening. Finds tomorrow's not-yet-reminded appointments
 * and sends the client a WhatsApp/email reminder. Protected by CRON_SECRET
 * so it can't be triggered by anyone who finds the URL.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tomorrow = addCalendarDays(zonedNow(), 1);
  const tomorrowStr = zurichDateString(tomorrow);
  const dayAfterStr = zurichDateString(addCalendarDays(tomorrow, 1));

  const rangeStartUtc = zurichWallTimeToUtc(tomorrowStr, "00:00").toISOString();
  const rangeEndUtc = zurichWallTimeToUtc(dayAfterStr, "00:00").toISOString();

  const supabase = getSupabaseAdmin();
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("*, clients(id, name, phone, email, preferred_language)")
    .in("status", ["pending", "confirmed"])
    .is("reminder_sent_at", null)
    .gte("scheduled_start", rangeStartUtc)
    .lt("scheduled_start", rangeEndUtc);

  if (error) {
    console.error("Failed to fetch appointments for reminders:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of appointments ?? []) {
    const { clients: client, ...appointment } = row;
    try {
      await sendBookingNotifications({ appointment, client, kind: "reminder" });
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appointment.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for appointment ${appointment.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, date: tomorrowStr });
}
