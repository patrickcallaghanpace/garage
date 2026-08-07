import { describe, expect, it } from "vitest";
import {
  computeDayCandidates,
  evaluateManualInsertion,
  rankCandidates,
  type CandidateGapResult,
  type ExistingAppointment,
  type LatLng,
} from "@/lib/services/scheduling-core";

// Test fixtures use `lat` purely as a stable point identifier (lng always 0)
// so drive times can be looked up from a small explicit table below — real
// coordinates aren't needed since the geometry module only ever calls the
// injected driveTimeMinutes(a, b) function.
const ANCHOR: LatLng = { lat: 0, lng: 0 };
const JOB_A: LatLng = { lat: 1, lng: 0 };
const JOB_B: LatLng = { lat: 2, lng: 0 };
const CANDIDATE: LatLng = { lat: 99, lng: 0 };

const DRIVE_TIMES: Record<string, number> = {
  "0-1": 15,
  "1-0": 15,
  "0-2": 40,
  "2-0": 40,
  "0-99": 25,
  "99-0": 25,
  "1-2": 5,
  "2-1": 5,
  "1-99": 8,
  "99-1": 8,
  "2-99": 6,
  "99-2": 6,
};

function driveTime(a: LatLng, b: LatLng): number | null {
  return DRIVE_TIMES[`${a.lat}-${b.lat}`] ?? null;
}

const apptA: ExistingAppointment = { id: "A", startMin: 540, endMin: 570, ...JOB_A };
const apptB: ExistingAppointment = { id: "B", startMin: 600, endMin: 630, ...JOB_B };

const WORKING_START = 480; // 08:00
const WORKING_END = 1080; // 18:00

describe("computeDayCandidates", () => {
  it("offers a single slot on an empty day", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [],
      candidate: CANDIDATE,
      durationMinutes: 30,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toEqual([
      {
        gapIndex: 0,
        startMin: 505, // 480 + 25 (anchor -> candidate)
        endMin: 535,
        driveTimeInMinutes: 25,
        driveTimeOutMinutes: null,
        marginalAddedMinutes: 25,
        prevAppointmentId: null,
        nextAppointmentId: null,
      },
    ]);
  });

  it("rejects a slot whose only leg exceeds the hard radius cap", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [],
      candidate: CANDIDATE,
      durationMinutes: 30,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 20, // anchor -> candidate is 25min
      efficiencyCapMinutes: null,
    });

    expect(results).toEqual([]);
  });

  it("finds one gap per position (before/between/after) and computes marginal added travel", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [apptA, apptB],
      candidate: CANDIDATE,
      durationMinutes: 10,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toHaveLength(3);

    const beforeA = results.find((r) => r.nextAppointmentId === "A")!;
    expect(beforeA).toMatchObject({
      prevAppointmentId: null,
      startMin: 505, // 480 + 25
      driveTimeInMinutes: 25,
      driveTimeOutMinutes: 8,
      marginalAddedMinutes: 18, // 25 + 8 - 15 (anchor->A original)
    });

    const betweenAB = results.find(
      (r) => r.prevAppointmentId === "A" && r.nextAppointmentId === "B"
    )!;
    expect(betweenAB).toMatchObject({
      startMin: 578, // 570 + 8
      driveTimeInMinutes: 8,
      driveTimeOutMinutes: 6,
      marginalAddedMinutes: 9, // 8 + 6 - 5 (A->B original)
    });

    const afterB = results.find((r) => r.prevAppointmentId === "B" && !r.nextAppointmentId)!;
    expect(afterB).toMatchObject({
      startMin: 636, // 630 + 6
      driveTimeInMinutes: 6,
      driveTimeOutMinutes: null,
      marginalAddedMinutes: 6,
    });
  });

  it("applies the efficiency cap when enabled, discarding costlier gaps", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [apptA, apptB],
      candidate: CANDIDATE,
      durationMinutes: 10,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: 8,
    });

    // marginals are 18 (before A), 9 (between), 6 (after B) — only 6 survives
    expect(results).toHaveLength(1);
    expect(results[0].marginalAddedMinutes).toBe(6);
    expect(results[0].prevAppointmentId).toBe("B");
  });

  it("ignores the efficiency cap entirely when disabled (null), even for costly gaps", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [apptA, apptB],
      candidate: CANDIDATE,
      durationMinutes: 10,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toHaveLength(3);
  });

  it("hard radius cap rejects a gap when the outgoing leg alone exceeds it", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [apptA, apptB],
      candidate: CANDIDATE,
      durationMinutes: 10,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 7, // A<->candidate(8) and anchor<->candidate(25) both exceed; B<->candidate(6) doesn't
      efficiencyCapMinutes: null,
    });

    // only the "after B" gap survives: both its legs (in=6) are <= 7
    expect(results).toHaveLength(1);
    expect(results[0].prevAppointmentId).toBe("B");
  });

  it("splits a gap around the lunch break into up to two usable sub-windows", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: 720, // 12:00
      lunchEndMin: 810, // 13:30
      anchor: ANCHOR,
      appointments: [],
      candidate: CANDIDATE,
      durationMinutes: 60,
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toHaveLength(2);
    const morning = results.find((r) => r.startMin < 720)!;
    const afternoon = results.find((r) => r.startMin >= 810)!;
    expect(morning.startMin).toBe(505); // 480 + 25, ends 565, fits before 720
    expect(afternoon.startMin).toBe(810); // can't start before lunch ends
  });

  it("drops the morning sub-window when the job can't finish before lunch, keeps the afternoon one", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: 720,
      lunchEndMin: 810,
      anchor: ANCHOR,
      appointments: [],
      candidate: CANDIDATE,
      durationMinutes: 250, // fits the 810-1080 afternoon window (270min) but not the 505-720 morning one (215min)
      earliestAllowedStartMin: WORKING_START,
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toHaveLength(1);
    expect(results[0].startMin).toBe(810);
  });

  it("returns nothing when there is no time left in the working day (e.g. clamped 'now' on today)", () => {
    const results = computeDayCandidates({
      workingEndMin: WORKING_END,
      lunchStartMin: null,
      lunchEndMin: null,
      anchor: ANCHOR,
      appointments: [],
      candidate: CANDIDATE,
      durationMinutes: 30,
      earliestAllowedStartMin: 1070, // 17:50, candidate needs 25min drive + 30min job
      driveTimeMinutes: driveTime,
      hardRadiusCapMinutes: 90,
      efficiencyCapMinutes: null,
    });

    expect(results).toEqual([]);
  });
});

describe("rankCandidates", () => {
  it("ranks soonest date first, then lowest marginal added travel, and applies the limit", () => {
    const base: Omit<CandidateGapResult, "startMin" | "marginalAddedMinutes"> = {
      gapIndex: 0,
      endMin: 100,
      driveTimeInMinutes: 5,
      driveTimeOutMinutes: null,
      prevAppointmentId: null,
      nextAppointmentId: null,
    };

    const byDate = new Map<string, CandidateGapResult[]>([
      [
        "2026-08-10",
        [
          { ...base, startMin: 500, marginalAddedMinutes: 20 },
          { ...base, startMin: 600, marginalAddedMinutes: 5 },
        ],
      ],
      [
        "2026-08-09",
        [{ ...base, startMin: 500, marginalAddedMinutes: 50 }],
      ],
    ]);

    const ranked = rankCandidates(byDate, 5);

    expect(ranked.map((r) => [r.date, r.marginalAddedMinutes])).toEqual([
      ["2026-08-09", 50],
      ["2026-08-10", 5],
      ["2026-08-10", 20],
    ]);
  });

  it("applies the limit across dates", () => {
    const base: Omit<CandidateGapResult, "startMin" | "marginalAddedMinutes"> = {
      gapIndex: 0,
      endMin: 100,
      driveTimeInMinutes: 5,
      driveTimeOutMinutes: null,
      prevAppointmentId: null,
      nextAppointmentId: null,
    };
    const byDate = new Map<string, CandidateGapResult[]>([
      [
        "2026-08-09",
        [
          { ...base, startMin: 1, marginalAddedMinutes: 1 },
          { ...base, startMin: 2, marginalAddedMinutes: 2 },
          { ...base, startMin: 3, marginalAddedMinutes: 3 },
        ],
      ],
    ]);

    expect(rankCandidates(byDate, 2)).toHaveLength(2);
  });
});

describe("evaluateManualInsertion", () => {
  const appointments = [apptA, apptB];

  it("computes impact for a slot inserted before the first job", () => {
    const impact = evaluateManualInsertion(appointments, ANCHOR, CANDIDATE, 500, 510, driveTime);
    expect(impact).toEqual({
      driveTimeInMinutes: 25,
      driveTimeOutMinutes: 8,
      marginalAddedMinutes: 18,
      prevAppointmentId: null,
      nextAppointmentId: "A",
    });
  });

  it("computes impact for a slot inserted between two jobs", () => {
    const impact = evaluateManualInsertion(appointments, ANCHOR, CANDIDATE, 580, 590, driveTime);
    expect(impact).toEqual({
      driveTimeInMinutes: 8,
      driveTimeOutMinutes: 6,
      marginalAddedMinutes: 9,
      prevAppointmentId: "A",
      nextAppointmentId: "B",
    });
  });

  it("computes impact for a slot inserted after the last job", () => {
    const impact = evaluateManualInsertion(appointments, ANCHOR, CANDIDATE, 650, 660, driveTime);
    expect(impact).toEqual({
      driveTimeInMinutes: 6,
      driveTimeOutMinutes: null,
      marginalAddedMinutes: 6,
      prevAppointmentId: "B",
      nextAppointmentId: null,
    });
  });

  it("does not enforce hard radius or efficiency caps (admin override)", () => {
    // anchor -> candidate is 25min; even with a tiny "cap" concept this
    // function has no cap parameters at all, so it should just report it.
    const impact = evaluateManualInsertion([], ANCHOR, CANDIDATE, 500, 510, driveTime);
    expect(impact.driveTimeInMinutes).toBe(25);
    expect(impact.marginalAddedMinutes).toBe(25);
  });
});
