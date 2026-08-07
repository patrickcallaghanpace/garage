import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  geocodeAddress,
  getDriveTimeMinutesMatrix,
  type LatLng,
  type SwissAddress,
} from "@/lib/google-maps";
import {
  computeDayCandidates,
  evaluateManualInsertion,
  rankCandidates,
  type CandidateGapResult,
  type ExistingAppointment,
} from "@/lib/services/scheduling-core";
import {
  addCalendarDays,
  addMinutes,
  zonedNow,
  zurichDateString,
  zurichIsoWeekday,
  zurichWallTimeToUtc,
  toZurich,
} from "@/lib/time";
import { MAX_SLOT_OPTIONS, SCHEDULING_LOOKAHEAD_DAYS } from "@/lib/constants";
import type {
  AdminSettingsRow,
  AppointmentRow,
  BookingSource,
  DailyOverrideRow,
  PreferredLanguage,
  StartAnchor,
} from "@/lib/types/database";
import { sendBookingNotifications } from "@/lib/services/notifications";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class SchedulingError extends Error {}
export class AddressNotGeocodableError extends SchedulingError {
  constructor() {
    super("We couldn't locate that address. Please check it and try again.");
  }
}
export class InvalidServiceTypeError extends SchedulingError {
  constructor() {
    super("Unknown or inactive service type.");
  }
}
export class SlotNoLongerAvailableError extends SchedulingError {
  constructor() {
    super("That time slot is no longer available. Please choose another.");
  }
}
export class BookingNotFoundError extends SchedulingError {
  constructor() {
    super("Booking not found.");
  }
}
export class BookingConflictError extends SchedulingError {
  constructor() {
    super("That time conflicts with another appointment.");
  }
}
export class AdminNotConfiguredError extends SchedulingError {
  constructor(missing: string) {
    super(`Admin settings are incomplete: ${missing} is not configured yet.`);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor(min % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}`;
}

const WEEKDAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

interface ResolvedAnchor {
  lat: number;
  lng: number;
  type: StartAnchor | "current_location";
}

function resolveAnchor(
  settings: AdminSettingsRow,
  override: DailyOverrideRow | undefined
): ResolvedAnchor | null {
  if (override) {
    if (override.start_anchor_type === "current_location") {
      if (override.custom_lat == null || override.custom_lng == null) return null;
      return { lat: override.custom_lat, lng: override.custom_lng, type: "current_location" };
    }
    if (override.start_anchor_type === "home") {
      if (settings.home_lat == null || settings.home_lng == null) return null;
      return { lat: settings.home_lat, lng: settings.home_lng, type: "home" };
    }
    if (settings.work_lat == null || settings.work_lng == null) return null;
    return { lat: settings.work_lat, lng: settings.work_lng, type: "work" };
  }

  if (settings.default_start_anchor === "home") {
    if (settings.home_lat == null || settings.home_lng == null) return null;
    return { lat: settings.home_lat, lng: settings.home_lng, type: "home" };
  }
  if (settings.work_lat == null || settings.work_lng == null) return null;
  return { lat: settings.work_lat, lng: settings.work_lng, type: "work" };
}

async function fetchAdminSettings(): Promise<AdminSettingsRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    throw new AdminNotConfiguredError("admin_settings row");
  }
  return data;
}

interface DayWindowRange {
  startDate: string;
  endDateExclusive: string;
}

function lookaheadRange(): DayWindowRange {
  const start = zonedNow();
  const startDate = zurichDateString(start);
  const end = addCalendarDays(start, SCHEDULING_LOOKAHEAD_DAYS);
  const endDateExclusive = zurichDateString(end);
  return { startDate, endDateExclusive };
}

async function fetchOverridesInRange(
  range: DayWindowRange
): Promise<Map<string, DailyOverrideRow>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_overrides")
    .select("*")
    .gte("date", range.startDate)
    .lt("date", range.endDateExclusive);
  if (error) throw error;
  const map = new Map<string, DailyOverrideRow>();
  for (const row of data ?? []) map.set(row.date, row);
  return map;
}

async function fetchAppointmentsInRange(
  range: DayWindowRange,
  excludeAppointmentId?: string
): Promise<AppointmentRow[]> {
  const supabase = getSupabaseAdmin();
  const rangeStartUtc = zurichWallTimeToUtc(range.startDate, "00:00").toISOString();
  const rangeEndUtc = zurichWallTimeToUtc(range.endDateExclusive, "00:00").toISOString();

  let query = supabase
    .from("appointments")
    .select("*")
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_start", rangeStartUtc)
    .lt("scheduled_start", rangeEndUtc)
    .order("scheduled_start", { ascending: true });

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function groupAppointmentsByZurichDate(
  appointments: AppointmentRow[]
): Map<string, ExistingAppointment[]> {
  const byDate = new Map<string, ExistingAppointment[]>();
  for (const appt of appointments) {
    const startZoned = toZurich(new Date(appt.scheduled_start));
    const endZoned = toZurich(new Date(appt.scheduled_end));
    const dateStr = zurichDateString(startZoned);
    const entry: ExistingAppointment = {
      id: appt.id,
      startMin: startZoned.getHours() * 60 + startZoned.getMinutes(),
      endMin: endZoned.getHours() * 60 + endZoned.getMinutes(),
      lat: appt.lat,
      lng: appt.lng,
    };
    const list = byDate.get(dateStr) ?? [];
    list.push(entry);
    byDate.set(dateStr, list);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.startMin - b.startMin);
  return byDate;
}

/** Builds a synchronous drive-time lookup backed by one Distance Matrix call per day. */
async function buildDayDriveTimeLookup(
  anchor: LatLng,
  dayAppointments: ExistingAppointment[],
  candidate: LatLng
): Promise<(a: LatLng, b: LatLng) => number | null> {
  const points: LatLng[] = [anchor, ...dayAppointments];
  const allNodes: LatLng[] = [...points, candidate];
  const matrix = await getDriveTimeMinutesMatrix(allNodes, allNodes);

  const keyOf = (p: LatLng) => `${p.lat},${p.lng}`;
  const indexOf = new Map<string, number>();
  allNodes.forEach((p, i) => {
    if (!indexOf.has(keyOf(p))) indexOf.set(keyOf(p), i);
  });

  return (a: LatLng, b: LatLng) => {
    const i = indexOf.get(keyOf(a));
    const j = indexOf.get(keyOf(b));
    if (i == null || j == null) return null;
    return matrix[i]?.[j] ?? null;
  };
}

// ---------------------------------------------------------------------------
// findAvailableSlots
// ---------------------------------------------------------------------------

export interface SlotOption {
  date: string; // yyyy-MM-dd, Zurich
  startIso: string;
  endIso: string;
  driveTimeInMinutes: number;
  driveTimeOutMinutes: number | null;
  marginalAddedMinutes: number;
  startAnchorType: StartAnchor | "current_location";
}

export interface FindSlotsParams {
  serviceTypeId: string;
  address: SwissAddress;
  /** Excludes this appointment's own slot from conflict checks (reschedule). */
  excludeAppointmentId?: string;
}

async function geocodeOrThrow(address: SwissAddress): Promise<LatLng> {
  const location = await geocodeAddress(address);
  if (!location) throw new AddressNotGeocodableError();
  return location;
}

async function getActiveServiceDuration(serviceTypeId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("service_types")
    .select("default_duration_minutes, active")
    .eq("id", serviceTypeId)
    .single();
  if (error || !data || !data.active) throw new InvalidServiceTypeError();
  return data.default_duration_minutes;
}

async function computeCandidatesForDate(
  dateStr: string,
  settings: AdminSettingsRow,
  override: DailyOverrideRow | undefined,
  dayAppointments: ExistingAppointment[],
  candidate: LatLng,
  durationMinutes: number
): Promise<CandidateGapResult[]> {
  const zonedDate = toZurich(zurichWallTimeToUtc(dateStr, "12:00"));
  const weekdayKey = WEEKDAY_KEYS[zurichIsoWeekday(zonedDate) - 1];
  const hours = settings.working_hours[weekdayKey];
  if (!hours.open || !hours.start || !hours.end) return [];

  const anchor = resolveAnchor(settings, override);
  if (!anchor) return [];

  const workingStartMin = hhmmToMinutes(hours.start);
  const workingEndMin = hhmmToMinutes(hours.end);

  const now = zonedNow();
  const isToday = zurichDateString(now) === dateStr;
  let earliestAllowedStartMin = workingStartMin;
  if (isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    earliestAllowedStartMin = Math.max(workingStartMin, Math.ceil(nowMin / 5) * 5);
    if (earliestAllowedStartMin >= workingEndMin) return [];
  }

  const lunchStartMin = settings.lunch_break_start
    ? hhmmToMinutes(settings.lunch_break_start.slice(0, 5))
    : null;
  const lunchEndMin = settings.lunch_break_end
    ? hhmmToMinutes(settings.lunch_break_end.slice(0, 5))
    : null;

  let driveTimeMinutes: (a: LatLng, b: LatLng) => number | null;
  try {
    driveTimeMinutes = await buildDayDriveTimeLookup(anchor, dayAppointments, candidate);
  } catch {
    // Distance Matrix hiccup for this day — skip it rather than fail the whole search.
    return [];
  }

  return computeDayCandidates({
    workingEndMin,
    lunchStartMin,
    lunchEndMin,
    anchor,
    appointments: dayAppointments,
    candidate,
    durationMinutes,
    earliestAllowedStartMin,
    driveTimeMinutes,
    hardRadiusCapMinutes: settings.hard_radius_minutes,
    efficiencyCapMinutes: settings.efficiency_cap_enabled
      ? settings.efficiency_cap_minutes
      : null,
  });
}

export async function findAvailableSlots(params: FindSlotsParams): Promise<SlotOption[]> {
  const [settings, location, durationMinutes] = await Promise.all([
    fetchAdminSettings(),
    geocodeOrThrow(params.address),
    getActiveServiceDuration(params.serviceTypeId),
  ]);

  const range = lookaheadRange();
  const [overrides, appointments] = await Promise.all([
    fetchOverridesInRange(range),
    fetchAppointmentsInRange(range, params.excludeAppointmentId),
  ]);
  const appointmentsByDate = groupAppointmentsByZurichDate(appointments);

  const dayOffsets = Array.from({ length: SCHEDULING_LOOKAHEAD_DAYS }, (_, i) => i);
  const now = zonedNow();

  const perDayResults = await Promise.all(
    dayOffsets.map(async (offset) => {
      const zonedDate = addCalendarDays(now, offset);
      const dateStr = zurichDateString(zonedDate);
      const candidates = await computeCandidatesForDate(
        dateStr,
        settings,
        overrides.get(dateStr),
        appointmentsByDate.get(dateStr) ?? [],
        location,
        durationMinutes
      );
      return { dateStr, candidates };
    })
  );

  const candidatesByDate = new Map<string, CandidateGapResult[]>();
  for (const { dateStr, candidates } of perDayResults) {
    if (candidates.length) candidatesByDate.set(dateStr, candidates);
  }

  const ranked = rankCandidates(candidatesByDate, MAX_SLOT_OPTIONS);

  return ranked.map((c) => {
    const override = overrides.get(c.date);
    const anchor = resolveAnchor(settings, override)!;
    return {
      date: c.date,
      startIso: zurichWallTimeToUtc(c.date, minutesToHHMM(c.startMin)).toISOString(),
      endIso: zurichWallTimeToUtc(c.date, minutesToHHMM(c.endMin)).toISOString(),
      driveTimeInMinutes: c.driveTimeInMinutes,
      driveTimeOutMinutes: c.driveTimeOutMinutes,
      marginalAddedMinutes: c.marginalAddedMinutes,
      startAnchorType: anchor.type,
    };
  });
}

// ---------------------------------------------------------------------------
// createBooking
// ---------------------------------------------------------------------------

export interface ClientContactInput {
  name: string;
  phone: string;
  email: string;
  preferredLanguage: PreferredLanguage;
}

export interface CreateBookingParams {
  serviceTypeId: string;
  address: SwissAddress;
  client: ClientContactInput;
  chosenStartIso: string;
  source: BookingSource;
  notes?: string;
}

export interface BookingResult {
  appointment: AppointmentRow;
}

async function upsertClient(
  client: ClientContactInput,
  address: SwissAddress,
  location: LatLng
) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("clients")
    .select("*")
    .eq("email", client.email)
    .maybeSingle();

  const payload = {
    name: client.name,
    phone: client.phone,
    email: client.email,
    address_street: address.street,
    address_postal_code: address.postalCode,
    address_locality: address.locality,
    address_canton: address.canton,
    lat: location.lat,
    lng: location.lng,
    preferred_language: client.preferredLanguage,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Failed to update client");
    return data;
  }

  const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
  if (error || !data) throw error ?? new Error("Failed to create client");
  return data;
}

/** True if `err` is a Postgres exclusion/unique-constraint violation. */
function isConflictError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "23P01" || code === "23505";
}

export async function createBooking(params: CreateBookingParams): Promise<BookingResult> {
  const [settings, location, durationMinutes] = await Promise.all([
    fetchAdminSettings(),
    geocodeOrThrow(params.address),
    getActiveServiceDuration(params.serviceTypeId),
  ]);

  const chosenStart = toZurich(new Date(params.chosenStartIso));
  const dateStr = zurichDateString(chosenStart);
  const chosenStartMin = chosenStart.getHours() * 60 + chosenStart.getMinutes();

  const dayEndExclusive = zurichDateString(addCalendarDays(chosenStart, 1));
  const [overrides, appointments] = await Promise.all([
    fetchOverridesInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
    fetchAppointmentsInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
  ]);

  const dayAppointments = groupAppointmentsByZurichDate(appointments).get(dateStr) ?? [];

  const candidates = await computeCandidatesForDate(
    dateStr,
    settings,
    overrides.get(dateStr),
    dayAppointments,
    location,
    durationMinutes
  );

  const match = candidates.find((c) => c.startMin === chosenStartMin);
  if (!match) throw new SlotNoLongerAvailableError();

  const scheduledStart = zurichWallTimeToUtc(dateStr, minutesToHHMM(match.startMin));
  const scheduledEnd = zurichWallTimeToUtc(dateStr, minutesToHHMM(match.endMin));

  const client = await upsertClient(params.client, params.address, location);

  const supabase = getSupabaseAdmin();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      client_id: client.id,
      service_type_id: params.serviceTypeId,
      address_street: params.address.street,
      address_postal_code: params.address.postalCode,
      address_locality: params.address.locality,
      address_canton: params.address.canton,
      lat: location.lat,
      lng: location.lng,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      status: "confirmed",
      source: params.source,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (isConflictError(error)) throw new SlotNoLongerAvailableError();
    throw error;
  }
  if (!appointment) throw new Error("Failed to create appointment");

  sendBookingNotifications({ appointment, client, kind: "created" }).catch((err) => {
    console.error("Failed to send booking notifications", err);
  });

  return { appointment };
}

// ---------------------------------------------------------------------------
// getBookingByToken / cancelBooking / rescheduleBooking
// ---------------------------------------------------------------------------

export interface BookingDetails {
  appointment: AppointmentRow;
  client: { id: string; name: string; phone: string; email: string; preferred_language: PreferredLanguage };
  serviceType: { id: string; name_fr: string; name_en: string };
}

export async function getBookingByToken(token: string): Promise<BookingDetails | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, clients(id, name, phone, email, preferred_language), service_types(id, name_fr, name_en)")
    .eq("reschedule_cancel_token", token)
    .maybeSingle();

  if (error || !data) return null;

  const { clients, service_types, ...appointment } = data as unknown as AppointmentRow & {
    clients: BookingDetails["client"];
    service_types: BookingDetails["serviceType"];
  };

  return { appointment, client: clients, serviceType: service_types };
}

export async function cancelBooking(token: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("reschedule_cancel_token", token)
    .maybeSingle();

  if (fetchError || !appointment) throw new BookingNotFoundError();
  if (appointment.status === "cancelled") return;

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id);
  if (error) throw error;

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", appointment.client_id)
    .single();
  if (client) {
    sendBookingNotifications({ appointment, client, kind: "cancelled" }).catch((err) => {
      console.error("Failed to send cancellation notifications", err);
    });
  }
}

export async function findAvailableSlotsForReschedule(token: string): Promise<SlotOption[]> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new BookingNotFoundError();
  if (booking.appointment.status === "cancelled" || booking.appointment.status === "completed") {
    throw new SchedulingError("This booking can no longer be rescheduled.");
  }

  return findAvailableSlots({
    serviceTypeId: booking.appointment.service_type_id,
    address: {
      street: booking.appointment.address_street,
      postalCode: booking.appointment.address_postal_code,
      locality: booking.appointment.address_locality,
      canton: booking.appointment.address_canton,
    },
    excludeAppointmentId: booking.appointment.id,
  });
}

export async function rescheduleBooking(
  token: string,
  chosenStartIso: string
): Promise<BookingResult> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new BookingNotFoundError();
  if (booking.appointment.status === "cancelled" || booking.appointment.status === "completed") {
    throw new SchedulingError("This booking can no longer be rescheduled.");
  }

  const settings = await fetchAdminSettings();
  const location: LatLng = { lat: booking.appointment.lat, lng: booking.appointment.lng };
  const durationMinutes =
    Math.round(
      (new Date(booking.appointment.scheduled_end).getTime() -
        new Date(booking.appointment.scheduled_start).getTime()) /
        60000
    ) || 30;

  const chosenStart = toZurich(new Date(chosenStartIso));
  const dateStr = zurichDateString(chosenStart);
  const chosenStartMin = chosenStart.getHours() * 60 + chosenStart.getMinutes();
  const dayEndExclusive = zurichDateString(addCalendarDays(chosenStart, 1));

  const [overrides, appointments] = await Promise.all([
    fetchOverridesInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
    fetchAppointmentsInRange(
      { startDate: dateStr, endDateExclusive: dayEndExclusive },
      booking.appointment.id
    ),
  ]);
  const dayAppointments = groupAppointmentsByZurichDate(appointments).get(dateStr) ?? [];

  const candidates = await computeCandidatesForDate(
    dateStr,
    settings,
    overrides.get(dateStr),
    dayAppointments,
    location,
    durationMinutes
  );

  const match = candidates.find((c) => c.startMin === chosenStartMin);
  if (!match) throw new SlotNoLongerAvailableError();

  const scheduledStart = zurichWallTimeToUtc(dateStr, minutesToHHMM(match.startMin));
  const scheduledEnd = zurichWallTimeToUtc(dateStr, minutesToHHMM(match.endMin));

  const supabase = getSupabaseAdmin();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      status: "confirmed",
    })
    .eq("id", booking.appointment.id)
    .select("*")
    .single();

  if (error) {
    if (isConflictError(error)) throw new SlotNoLongerAvailableError();
    throw error;
  }
  if (!appointment) throw new Error("Failed to reschedule appointment");

  sendBookingNotifications({
    appointment,
    client: booking.client,
    kind: "rescheduled",
  }).catch((err) => console.error("Failed to send reschedule notifications", err));

  return { appointment };
}

// ---------------------------------------------------------------------------
// Admin manual booking (not bound by hard/efficiency caps)
// ---------------------------------------------------------------------------

export interface ManualBookingImpact {
  driveTimeInMinutes: number | null;
  driveTimeOutMinutes: number | null;
  marginalAddedMinutes: number | null;
  prevAppointmentId: string | null;
  nextAppointmentId: string | null;
}

async function computeManualImpact(
  dateStr: string,
  settings: AdminSettingsRow,
  override: DailyOverrideRow | undefined,
  dayAppointments: ExistingAppointment[],
  candidate: LatLng,
  startMin: number,
  endMin: number
): Promise<ManualBookingImpact> {
  const anchor = resolveAnchor(settings, override);
  if (!anchor) {
    return {
      driveTimeInMinutes: null,
      driveTimeOutMinutes: null,
      marginalAddedMinutes: null,
      prevAppointmentId: null,
      nextAppointmentId: null,
    };
  }

  try {
    const driveTimeMinutes = await buildDayDriveTimeLookup(anchor, dayAppointments, candidate);
    return evaluateManualInsertion(
      dayAppointments,
      anchor,
      candidate,
      startMin,
      endMin,
      driveTimeMinutes
    );
  } catch {
    return {
      driveTimeInMinutes: null,
      driveTimeOutMinutes: null,
      marginalAddedMinutes: null,
      prevAppointmentId: null,
      nextAppointmentId: null,
    };
  }
}

export interface AdminBookingParams {
  serviceTypeId: string;
  address: SwissAddress;
  client: ClientContactInput;
  startIso: string;
  durationMinutes: number;
  source: Extract<BookingSource, "phone" | "admin_manual">;
  notes?: string;
}

export interface AdminBookingResult {
  appointment: AppointmentRow;
  impact: ManualBookingImpact;
}

export async function previewManualBookingImpact(
  params: Omit<AdminBookingParams, "client" | "source" | "notes">
): Promise<ManualBookingImpact> {
  const [settings, location] = await Promise.all([
    fetchAdminSettings(),
    geocodeOrThrow(params.address),
  ]);

  const start = toZurich(new Date(params.startIso));
  const dateStr = zurichDateString(start);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + params.durationMinutes;
  const dayEndExclusive = zurichDateString(addCalendarDays(start, 1));

  const [overrides, appointments] = await Promise.all([
    fetchOverridesInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
    fetchAppointmentsInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
  ]);
  const dayAppointments = groupAppointmentsByZurichDate(appointments).get(dateStr) ?? [];

  return computeManualImpact(
    dateStr,
    settings,
    overrides.get(dateStr),
    dayAppointments,
    location,
    startMin,
    endMin
  );
}

export async function adminCreateBooking(
  params: AdminBookingParams
): Promise<AdminBookingResult> {
  const [settings, location] = await Promise.all([
    fetchAdminSettings(),
    geocodeOrThrow(params.address),
  ]);

  const start = toZurich(new Date(params.startIso));
  const dateStr = zurichDateString(start);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + params.durationMinutes;
  const dayEndExclusive = zurichDateString(addCalendarDays(start, 1));

  const [overrides, appointments] = await Promise.all([
    fetchOverridesInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
    fetchAppointmentsInRange({ startDate: dateStr, endDateExclusive: dayEndExclusive }),
  ]);
  const dayAppointments = groupAppointmentsByZurichDate(appointments).get(dateStr) ?? [];

  const impact = await computeManualImpact(
    dateStr,
    settings,
    overrides.get(dateStr),
    dayAppointments,
    location,
    startMin,
    endMin
  );

  const client = await upsertClient(params.client, params.address, location);

  const scheduledStart = zurichWallTimeToUtc(dateStr, minutesToHHMM(startMin));
  const scheduledEnd = addMinutes(scheduledStart, params.durationMinutes);

  const supabase = getSupabaseAdmin();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      client_id: client.id,
      service_type_id: params.serviceTypeId,
      address_street: params.address.street,
      address_postal_code: params.address.postalCode,
      address_locality: params.address.locality,
      address_canton: params.address.canton,
      lat: location.lat,
      lng: location.lng,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      status: "confirmed",
      source: params.source,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (isConflictError(error)) throw new BookingConflictError();
    throw error;
  }
  if (!appointment) throw new Error("Failed to create appointment");

  sendBookingNotifications({ appointment, client, kind: "created" }).catch((err) => {
    console.error("Failed to send booking notifications", err);
  });

  return { appointment, impact };
}
