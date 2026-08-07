/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
 * If you have the Supabase CLI linked to a project, prefer regenerating this
 * with `supabase gen types typescript` and keeping the shape below in sync.
 */

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid_onsite" | "paid_online";
export type BookingSource = "online" | "phone" | "admin_manual";
export type StartAnchor = "home" | "work";
export type DailyOverrideAnchor = "home" | "work" | "current_location";
export type PreferredLanguage = "fr" | "en";

export interface WorkingHoursDay {
  open: boolean;
  start: string | null; // "HH:MM"
  end: string | null; // "HH:MM"
}

export type WorkingHours = Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", WorkingHoursDay>;

export interface NotificationPrefs {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  admin_email: string | null;
  admin_whatsapp_number: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  address_street: string;
  address_postal_code: string;
  address_locality: string;
  address_canton: string;
  lat: number | null;
  lng: number | null;
  preferred_language: PreferredLanguage;
  created_at: string;
  updated_at: string;
}

export interface ServiceTypeRow {
  id: string;
  name_fr: string;
  name_en: string;
  default_duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow {
  id: string;
  client_id: string;
  service_type_id: string;
  address_street: string;
  address_postal_code: string;
  address_locality: string;
  address_canton: string;
  lat: number;
  lng: number;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  payment_amount: number | null;
  payment_currency: string;
  stripe_payment_intent_id: string | null;
  source: BookingSource;
  notes: string | null;
  reschedule_cancel_token: string;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSettingsRow {
  id: number;
  home_address_street: string | null;
  home_address_postal_code: string | null;
  home_address_locality: string | null;
  home_address_canton: string | null;
  home_lat: number | null;
  home_lng: number | null;
  work_address_street: string | null;
  work_address_postal_code: string | null;
  work_address_locality: string | null;
  work_address_canton: string | null;
  work_lat: number | null;
  work_lng: number | null;
  default_start_anchor: StartAnchor;
  working_hours: WorkingHours;
  lunch_break_start: string;
  lunch_break_end: string;
  hard_radius_minutes: number;
  efficiency_cap_enabled: boolean;
  efficiency_cap_minutes: number | null;
  notification_prefs: NotificationPrefs;
  updated_at: string;
}

export interface DailyOverrideRow {
  id: string;
  date: string;
  start_anchor_type: DailyOverrideAnchor;
  custom_lat: number | null;
  custom_lng: number | null;
  created_at: string;
}

type TableDef<Row, InsertOptional extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Pick<Row, InsertOptional>> & Omit<Row, InsertOptional>;
  Update: Partial<Row>;
};

export interface Database {
  public: {
    Tables: {
      clients: TableDef<
        ClientRow,
        "id" | "lat" | "lng" | "preferred_language" | "created_at" | "updated_at"
      >;
      service_types: TableDef<
        ServiceTypeRow,
        "id" | "active" | "sort_order" | "created_at" | "updated_at"
      >;
      appointments: TableDef<
        AppointmentRow,
        | "id"
        | "status"
        | "payment_status"
        | "payment_amount"
        | "payment_currency"
        | "stripe_payment_intent_id"
        | "notes"
        | "reschedule_cancel_token"
        | "reminder_sent_at"
        | "created_at"
        | "updated_at"
      >;
      admin_settings: TableDef<AdminSettingsRow, "id">;
      daily_overrides: TableDef<
        DailyOverrideRow,
        "id" | "custom_lat" | "custom_lng" | "created_at"
      >;
    };
  };
}
