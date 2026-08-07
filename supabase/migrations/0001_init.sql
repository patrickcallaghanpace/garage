-- Mobile garage booking app: initial schema
-- All access to these tables goes through the Next.js server using the
-- Supabase service role key (see src/lib/supabase/admin.ts). RLS is enabled
-- on every table with NO policies, so the anon/authenticated keys used by
-- the browser can never read or write them directly, even by accident.
-- Supabase Auth (for the admin login) is unaffected by this — auth.users is
-- managed separately by Supabase.

create extension if not exists pgcrypto;
-- required for the GiST exclusion constraint that prevents double-booked/overlapping
-- appointments at the database level (our race-condition safety net)
create extension if not exists btree_gist;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  address_street text not null,
  address_postal_code text not null,
  address_locality text not null,
  address_canton text not null,
  lat double precision,
  lng double precision,
  preferred_language text not null default 'fr' check (preferred_language in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

create index clients_email_idx on clients (email);
create index clients_phone_idx on clients (phone);

alter table clients enable row level security;

-- ---------------------------------------------------------------------------
-- service_types
-- ---------------------------------------------------------------------------
create table service_types (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  default_duration_minutes integer not null check (default_duration_minutes > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger service_types_set_updated_at
  before update on service_types
  for each row execute function set_updated_at();

alter table service_types enable row level security;

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete restrict,
  service_type_id uuid not null references service_types (id) on delete restrict,

  -- address snapshot at time of booking (client address may change later)
  address_street text not null,
  address_postal_code text not null,
  address_locality text not null,
  address_canton text not null,
  lat double precision not null,
  lng double precision not null,

  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,

  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),

  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid_onsite', 'paid_online')),
  payment_amount numeric(10, 2),
  payment_currency text not null default 'CHF',
  stripe_payment_intent_id text,

  source text not null check (source in ('online', 'phone', 'admin_manual')),
  notes text,

  reschedule_cancel_token text not null unique default encode(gen_random_bytes(24), 'hex'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_time_order check (scheduled_end > scheduled_start),

  -- generated range used by the exclusion constraint below
  time_range tstzrange generated always as (tstzrange(scheduled_start, scheduled_end, '[)')) stored
);

-- Database-level race-condition guard: two overlapping pending/confirmed
-- appointments can never both commit, even under concurrent booking requests.
-- The service layer (src/lib/services/scheduling.ts) re-validates candidate
-- slots before insert, but this constraint is the actual source of truth —
-- if it fires, the caller re-runs findAvailableSlots() and shows fresh options.
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (time_range with &&)
  where (status in ('pending', 'confirmed'));

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create index appointments_scheduled_start_idx on appointments (scheduled_start);
create index appointments_client_id_idx on appointments (client_id);
create index appointments_status_idx on appointments (status);
create index appointments_token_idx on appointments (reschedule_cancel_token);
-- fast lookup of the day's active (non-cancelled) schedule for the engine
create index appointments_active_schedule_idx on appointments (scheduled_start)
  where status in ('pending', 'confirmed');

alter table appointments enable row level security;

-- ---------------------------------------------------------------------------
-- admin_settings (singleton row)
-- ---------------------------------------------------------------------------
create table admin_settings (
  id integer primary key default 1 check (id = 1),

  home_address_street text,
  home_address_postal_code text,
  home_address_locality text,
  home_address_canton text,
  home_lat double precision,
  home_lng double precision,

  work_address_street text,
  work_address_postal_code text,
  work_address_locality text,
  work_address_canton text,
  work_lat double precision,
  work_lng double precision,

  default_start_anchor text not null default 'home' check (default_start_anchor in ('home', 'work')),

  -- keyed by ISO weekday: "1".."7" (Mon..Sun) -> { open: bool, start: "08:00", end: "18:00" }
  working_hours jsonb not null default '{
    "1": {"open": true, "start": "08:00", "end": "18:00"},
    "2": {"open": true, "start": "08:00", "end": "18:00"},
    "3": {"open": true, "start": "08:00", "end": "18:00"},
    "4": {"open": true, "start": "08:00", "end": "18:00"},
    "5": {"open": true, "start": "08:00", "end": "18:00"},
    "6": {"open": false, "start": null, "end": null},
    "7": {"open": false, "start": null, "end": null}
  }'::jsonb,

  lunch_break_start time not null default '12:00',
  lunch_break_end time not null default '13:30',

  hard_radius_minutes integer not null default 90 check (hard_radius_minutes > 0),
  efficiency_cap_enabled boolean not null default false,
  efficiency_cap_minutes integer,

  notification_prefs jsonb not null default '{
    "email_enabled": true,
    "whatsapp_enabled": true,
    "admin_email": null,
    "admin_whatsapp_number": null
  }'::jsonb,

  updated_at timestamptz not null default now()
);

create trigger admin_settings_set_updated_at
  before update on admin_settings
  for each row execute function set_updated_at();

alter table admin_settings enable row level security;

insert into admin_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- daily_overrides
-- ---------------------------------------------------------------------------
create table daily_overrides (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  start_anchor_type text not null check (start_anchor_type in ('home', 'work', 'current_location')),
  custom_lat double precision,
  custom_lng double precision,
  created_at timestamptz not null default now(),

  constraint daily_overrides_current_location_has_coords
    check (start_anchor_type <> 'current_location' or (custom_lat is not null and custom_lng is not null))
);

create index daily_overrides_date_idx on daily_overrides (date);

alter table daily_overrides enable row level security;
