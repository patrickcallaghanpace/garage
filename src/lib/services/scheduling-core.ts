/**
 * Pure, side-effect-free scheduling geometry: given one day's working hours,
 * lunch block, existing appointments and a candidate job, work out every
 * gap where the candidate could be inserted, the drive-time cost of each,
 * and which ones survive the hard radius cap / optional efficiency cap.
 *
 * No Date/timezone objects and no I/O on purpose — everything is expressed
 * in "minutes since Zurich midnight" for a single day, and drive times come
 * from an injected lookup function. That makes this module trivial to unit
 * test (see src/lib/services/scheduling-core.test.ts) and reusable from both
 * the client-facing engine and the admin manual-booking impact preview.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ExistingAppointment {
  id: string;
  startMin: number;
  endMin: number;
  lat: number;
  lng: number;
}

export interface DayComputationInput {
  /** Working-hours end for the day, in minutes since midnight. */
  workingEndMin: number;
  lunchStartMin: number | null;
  lunchEndMin: number | null;
  anchor: LatLng;
  /** Sorted ascending by startMin, non-overlapping. */
  appointments: ExistingAppointment[];
  candidate: LatLng;
  durationMinutes: number;
  /**
   * Earliest minute the admin could conceivably leave the anchor point.
   * Equal to working-hours start for future days; clamped to "now" (rounded
   * up) for the current day so we never offer a slot in the past.
   */
  earliestAllowedStartMin: number;
  /** Drive time in minutes between two points, or null if no route exists. */
  driveTimeMinutes: (a: LatLng, b: LatLng) => number | null;
  hardRadiusCapMinutes: number;
  /** null = efficiency cap disabled. */
  efficiencyCapMinutes: number | null;
  /**
   * Offered start times are rounded UP to a multiple of this many minutes
   * (e.g. 15 -> :00/:15/:30/:45). Defaults to 1 (no rounding).
   */
  slotIncrementMinutes?: number;
}

export interface CandidateGapResult {
  gapIndex: number;
  startMin: number;
  endMin: number;
  driveTimeInMinutes: number;
  driveTimeOutMinutes: number | null;
  marginalAddedMinutes: number;
  prevAppointmentId: string | null;
  nextAppointmentId: string | null;
}

interface Window {
  start: number;
  end: number;
}

function splitAroundLunch(
  start: number,
  end: number,
  lunchStart: number | null,
  lunchEnd: number | null
): Window[] {
  if (start >= end) return [];
  if (lunchStart == null || lunchEnd == null || end <= lunchStart || start >= lunchEnd) {
    return [{ start, end }];
  }
  const windows: Window[] = [];
  if (start < lunchStart) windows.push({ start, end: lunchStart });
  if (end > lunchEnd) windows.push({ start: Math.max(start, lunchEnd), end });
  return windows.filter((w) => w.start < w.end);
}

/**
 * Returns every valid (hard-cap-respecting, optionally efficiency-cap-
 * respecting) slot for inserting `candidate` into this day's schedule, one
 * per usable sub-window, using earliest-fit within each.
 */
export function computeDayCandidates(input: DayComputationInput): CandidateGapResult[] {
  const { appointments: appts, durationMinutes } = input;
  const M = appts.length;
  const results: CandidateGapResult[] = [];

  const pointCoords = (idx: number): LatLng => (idx === -1 ? input.anchor : appts[idx]);

  for (let k = 0; k <= M; k++) {
    const prevIdx = k - 1;
    const prevLoc = pointCoords(prevIdx);
    const prevTime = k === 0 ? input.earliestAllowedStartMin : appts[k - 1].endMin;
    const hasNext = k < M;
    const nextLoc = hasNext ? pointCoords(k) : null;
    const nextTime = hasNext ? appts[k].startMin : input.workingEndMin;
    const prevAppointmentId = k === 0 ? null : appts[k - 1].id;
    const nextAppointmentId = hasNext ? appts[k].id : null;

    const leg1 = input.driveTimeMinutes(prevLoc, input.candidate);
    if (leg1 == null) continue;
    const leg2 = hasNext ? input.driveTimeMinutes(input.candidate, nextLoc!) : null;
    if (hasNext && leg2 == null) continue;

    if (leg1 > input.hardRadiusCapMinutes) continue;
    if (leg2 != null && leg2 > input.hardRadiusCapMinutes) continue;

    let marginalAdded: number;
    if (hasNext) {
      const originalDirect = input.driveTimeMinutes(prevLoc, nextLoc!);
      if (originalDirect == null) continue;
      marginalAdded = leg1 + leg2! - originalDirect;
    } else {
      marginalAdded = leg1;
    }

    if (input.efficiencyCapMinutes != null && marginalAdded > input.efficiencyCapMinutes) {
      continue;
    }

    const windows = splitAroundLunch(prevTime, nextTime, input.lunchStartMin, input.lunchEndMin);

    for (const w of windows) {
      const increment = input.slotIncrementMinutes ?? 1;
      const earliestStart =
        Math.ceil(Math.max(w.start, prevTime + leg1) / increment) * increment;
      const candidateEnd = earliestStart + durationMinutes;
      if (candidateEnd > w.end) continue;
      if (hasNext && candidateEnd + leg2! > nextTime) continue;
      if (!hasNext && candidateEnd > input.workingEndMin) continue;

      results.push({
        gapIndex: k,
        startMin: earliestStart,
        endMin: candidateEnd,
        driveTimeInMinutes: leg1,
        driveTimeOutMinutes: leg2,
        marginalAddedMinutes: marginalAdded,
        prevAppointmentId,
        nextAppointmentId,
      });
    }
  }

  return results;
}

export interface RankedCandidate extends CandidateGapResult {
  date: string;
}

/** Soonest date first, then lowest marginal added travel. */
export function rankCandidates(
  candidatesByDate: Map<string, CandidateGapResult[]>,
  limit: number
): RankedCandidate[] {
  const dates = [...candidatesByDate.keys()].sort();
  const flat: RankedCandidate[] = [];
  for (const date of dates) {
    for (const c of candidatesByDate.get(date)!) {
      flat.push({ ...c, date });
    }
  }
  flat.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.marginalAddedMinutes - b.marginalAddedMinutes;
  });
  return flat.slice(0, limit);
}

/**
 * Evaluates one specific admin-chosen time against the day's existing
 * schedule, ignoring both caps — used to show the "drive-time impact" of a
 * manual phone booking rather than to gate it. Working hours/lunch are also
 * not enforced here: the admin can override freely and use their judgement.
 */
export function evaluateManualInsertion(
  appointments: ExistingAppointment[],
  anchor: LatLng,
  candidate: LatLng,
  candidateStartMin: number,
  candidateEndMin: number,
  driveTimeMinutes: (a: LatLng, b: LatLng) => number | null
): {
  driveTimeInMinutes: number | null;
  driveTimeOutMinutes: number | null;
  marginalAddedMinutes: number | null;
  prevAppointmentId: string | null;
  nextAppointmentId: string | null;
} {
  const sorted = [...appointments].sort((a, b) => a.startMin - b.startMin);
  const before = sorted.filter((a) => a.endMin <= candidateStartMin);
  const after = sorted.filter((a) => a.startMin >= candidateEndMin);

  const prev = before.length ? before[before.length - 1] : null;
  const next = after.length ? after[0] : null;

  const prevLoc = prev ?? anchor;
  const leg1 = driveTimeMinutes(prevLoc, candidate);
  const leg2 = next ? driveTimeMinutes(candidate, next) : null;

  let marginal: number | null = null;
  if (leg1 != null) {
    if (next && leg2 != null) {
      const originalDirect = driveTimeMinutes(prevLoc, next);
      marginal = originalDirect != null ? leg1 + leg2 - originalDirect : null;
    } else if (!next) {
      marginal = leg1;
    }
  }

  return {
    driveTimeInMinutes: leg1,
    driveTimeOutMinutes: leg2,
    marginalAddedMinutes: marginal,
    prevAppointmentId: prev?.id ?? null,
    nextAppointmentId: next?.id ?? null,
  };
}
