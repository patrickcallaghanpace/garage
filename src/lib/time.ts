import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addDays, format } from "date-fns";
import { APP_TIMEZONE } from "@/lib/constants";

/** "Now", represented so its local getters (getDay, getHours...) read as Zurich wall time. */
export function zonedNow(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/** UTC instant -> Zurich-zoned Date (local getters read Zurich wall time). */
export function toZurich(utcDate: Date): Date {
  return toZonedTime(utcDate, APP_TIMEZONE);
}

/** `yyyy-MM-dd` for a Zurich-zoned Date (as returned by zonedNow/toZurich). */
export function zurichDateString(zonedDate: Date): string {
  return format(zonedDate, "yyyy-MM-dd");
}

/** ISO weekday, Monday=1..Sunday=7, for a Zurich-zoned Date. */
export function zurichIsoWeekday(zonedDate: Date): number {
  const day = zonedDate.getDay();
  return day === 0 ? 7 : day;
}

/** Builds the correct UTC instant for `HH:MM` wall-clock time on `dateStr` in Zurich. */
export function zurichWallTimeToUtc(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, APP_TIMEZONE);
}

export function addCalendarDays(zonedDate: Date, days: number): Date {
  return addDays(zonedDate, days);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60_000);
}
