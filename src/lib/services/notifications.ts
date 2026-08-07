import "server-only";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Resend } from "resend";
import twilio from "twilio";
import { env, isEmailConfigured, isWhatsappConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toE164Swiss } from "@/lib/phone";
import { toZurich } from "@/lib/time";
import type { AppointmentRow, PreferredLanguage } from "@/lib/types/database";

export type NotificationKind = "created" | "cancelled" | "rescheduled" | "reminder";

export interface NotifyClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  preferred_language: PreferredLanguage;
}

export interface SendBookingNotificationsParams {
  appointment: AppointmentRow;
  client: NotifyClient;
  kind: NotificationKind;
}

function formatWhen(appointment: AppointmentRow, locale: PreferredLanguage): string {
  const zoned = toZurich(new Date(appointment.scheduled_start));
  return format(zoned, "EEEE d MMMM yyyy 'à' HH:mm", {
    locale: locale === "fr" ? fr : enUS,
  });
}

async function getServiceTypeName(
  serviceTypeId: string,
  locale: PreferredLanguage
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("service_types")
    .select("name_fr, name_en")
    .eq("id", serviceTypeId)
    .single();
  if (!data) return locale === "fr" ? "Intervention" : "Service";
  return locale === "fr" ? data.name_fr : data.name_en;
}

function manageBookingUrl(token: string, locale: PreferredLanguage): string {
  const prefix = locale === "en" ? "/en" : "";
  return `${env.appUrl}${prefix}/booking/${token}`;
}

const CLIENT_COPY = {
  fr: {
    created: (when: string, service: string) =>
      `Votre rendez-vous "${service}" est confirmé pour le ${when}.`,
    cancelled: (when: string, service: string) =>
      `Votre rendez-vous "${service}" du ${when} a été annulé.`,
    rescheduled: (when: string, service: string) =>
      `Votre rendez-vous "${service}" a été déplacé au ${when}.`,
    reminder: (when: string, service: string) =>
      `Rappel : votre rendez-vous "${service}" est prévu demain, ${when}.`,
    manageLine: (url: string) => `Gérer mon rendez-vous : ${url}`,
    subject: {
      created: "Confirmation de votre rendez-vous",
      cancelled: "Annulation de votre rendez-vous",
      rescheduled: "Votre rendez-vous a été déplacé",
      reminder: "Rappel de votre rendez-vous de demain",
    },
  },
  en: {
    created: (when: string, service: string) =>
      `Your "${service}" appointment is confirmed for ${when}.`,
    cancelled: (when: string, service: string) =>
      `Your "${service}" appointment on ${when} has been cancelled.`,
    rescheduled: (when: string, service: string) =>
      `Your "${service}" appointment has been moved to ${when}.`,
    reminder: (when: string, service: string) =>
      `Reminder: your "${service}" appointment is tomorrow, ${when}.`,
    manageLine: (url: string) => `Manage your appointment: ${url}`,
    subject: {
      created: "Your appointment is confirmed",
      cancelled: "Your appointment was cancelled",
      rescheduled: "Your appointment was rescheduled",
      reminder: "Reminder: your appointment is tomorrow",
    },
  },
} as const;

async function sendClientEmail(
  params: SendBookingNotificationsParams,
  when: string,
  serviceName: string
) {
  if (!isEmailConfigured) return;
  const copy = CLIENT_COPY[params.client.preferred_language];
  const body = `${copy[params.kind](when, serviceName)}\n\n${copy.manageLine(
    manageBookingUrl(params.appointment.reschedule_cancel_token, params.client.preferred_language)
  )}`;

  const resend = new Resend(env.resendApiKey);
  await resend.emails.send({
    from: env.resendFromEmail!,
    to: params.client.email,
    subject: copy.subject[params.kind],
    text: body,
  });
}

async function sendClientWhatsapp(
  params: SendBookingNotificationsParams,
  when: string,
  serviceName: string
) {
  if (!isWhatsappConfigured) return;
  const copy = CLIENT_COPY[params.client.preferred_language];
  const body = `${copy[params.kind](when, serviceName)}\n${copy.manageLine(
    manageBookingUrl(params.appointment.reschedule_cancel_token, params.client.preferred_language)
  )}`;

  const client = twilio(env.twilioAccountSid, env.twilioAuthToken);
  await client.messages.create({
    from: env.twilioWhatsappFrom!,
    to: `whatsapp:${toE164Swiss(params.client.phone)}`,
    body,
  });
}

async function getAdminAlertTargets() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("admin_settings")
    .select("notification_prefs")
    .eq("id", 1)
    .single();
  return (
    data?.notification_prefs ?? {
      email_enabled: true,
      whatsapp_enabled: true,
      admin_email: null,
      admin_whatsapp_number: null,
    }
  );
}

const ADMIN_SUBJECT: Record<NotificationKind, string> = {
  created: "Nouvelle réservation",
  cancelled: "Réservation annulée",
  rescheduled: "Réservation déplacée",
  reminder: "Rappel", // unused — reminders don't alert the admin, see sendBookingNotifications
};

async function sendAdminAlert(
  params: SendBookingNotificationsParams,
  when: string,
  serviceName: string
) {
  const prefs = await getAdminAlertTargets();
  const summary = `${ADMIN_SUBJECT[params.kind]} — ${params.client.name} — ${serviceName} — ${when} — ${params.appointment.address_street}, ${params.appointment.address_postal_code} ${params.appointment.address_locality}`;

  if (isEmailConfigured && prefs.email_enabled && prefs.admin_email) {
    const resend = new Resend(env.resendApiKey);
    await resend.emails.send({
      from: env.resendFromEmail!,
      to: prefs.admin_email,
      subject: ADMIN_SUBJECT[params.kind],
      text: summary,
    });
  }

  if (isWhatsappConfigured && prefs.whatsapp_enabled && prefs.admin_whatsapp_number) {
    const client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    await client.messages.create({
      from: env.twilioWhatsappFrom!,
      to: `whatsapp:${toE164Swiss(prefs.admin_whatsapp_number)}`,
      body: summary,
    });
  }
}

/**
 * Fires all configured client + admin notifications for a booking event.
 * Every channel degrades gracefully: missing credentials just skip that
 * channel, and one channel's failure doesn't prevent the others from
 * running (see the Promise.allSettled below).
 */
export async function sendBookingNotifications(
  params: SendBookingNotificationsParams
): Promise<void> {
  const when = formatWhen(params.appointment, params.client.preferred_language);
  const serviceName = await getServiceTypeName(
    params.appointment.service_type_id,
    params.client.preferred_language
  );

  const tasks = [sendClientEmail(params, when, serviceName), sendClientWhatsapp(params, when, serviceName)];
  // Reminders are informational for the client only — the admin already
  // has the job on their calendar and doesn't need a day-before alert.
  if (params.kind !== "reminder") {
    tasks.push(sendAdminAlert(params, when, serviceName));
  }

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Notification channel failed:", result.reason);
    }
  }
}
