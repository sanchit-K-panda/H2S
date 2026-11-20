/**
 * Recovery recommendation engine for Domino Sky.
 * Generates valid recovery candidates (cancellations and spare swaps),
 * re-simulates the network deterministically for each, and ranks options.
 */

import { parseTimeToMinutes } from "./time";
import { simulate } from "./simulate";
import type {
  NetworkData,
  Closure,
  Action,
  RecoveryOption,
  Kpis,
  RecoveryDelta,
} from "./types";

/**
 * Computes difference between two KPI states: (after - before)
 */
export function computeKpiDelta(before: Kpis, after: Kpis): RecoveryDelta {
  return {
    delayedFlights: after.delayedFlights - before.delayedFlights,
    cancelledFlights: after.cancelledFlights - before.cancelledFlights,
    totalDelayMin: after.totalDelayMin - before.totalDelayMin,
    strandedPax: after.strandedPax - before.strandedPax,
    crewViolations: after.crewViolations - before.crewViolations,
  };
}

/**
 * Generates all candidate recovery actions allowed under airline operations:
 * - Cancel any scheduled flight
 * - Assign an eligible spare aircraft whose base, availability, and capacity match the flight
 */
export function generateCandidates(
  network: NetworkData
): { id: string; action: Action; label: string }[] {
  const candidates: { id: string; action: Action; label: string }[] = [];

  // 1. Cancel candidates
  for (const f of network.flights) {
    candidates.push({
      id: `cancel:${f.flight_id}`,
      action: { type: "cancel", flightId: f.flight_id },
      label: `Cancel ${f.flight_id} (${f.origin} → ${f.destination})`,
    });
  }

  // 2. Spare aircraft swap candidates
  for (const f of network.flights) {
    const flightDepMin = parseTimeToMinutes(f.dep);

    for (const spare of network.spare_aircraft) {
      const spareAvailMin = parseTimeToMinutes(spare.available_from);

      // Operational eligibility constraints
      const isBaseMatch = spare.base === f.origin;
      const isAvailable = spareAvailMin <= flightDepMin;
      const hasEnoughSeats = spare.seats >= f.pax;

      if (isBaseMatch && isAvailable && hasEnoughSeats) {
        candidates.push({
          id: `spare:${f.flight_id}:${spare.tail_id}`,
          action: {
            type: "spare",
            flightId: f.flight_id,
            spareTail: spare.tail_id,
          },
          label: `Swap spare ${spare.tail_id} at ${spare.base} onto ${f.flight_id}`,
        });
      }
    }
  }

  return candidates;
}

/**
 * Evaluates all candidates against the given closure scenario and ranks them.
 * Lexicographical sort order:
 * 1. strandedPax asc (minimizing stranded passengers is primary)
 * 2. crewViolations asc (preventing legal duty overruns)
 * 3. totalDelayMin asc (minimizing overall network disruption minutes)
 * 4. action id asc (stable tie-breaker)
 */
export function generateRecoveryOptions(
  network: NetworkData,
  closure?: Closure,
  limit: number = 3
): RecoveryOption[] {
  const baseline = simulate(network, closure);
  const candidates = generateCandidates(network);

  const evaluated: RecoveryOption[] = [];

  for (const cand of candidates) {
    const result = simulate(network, closure, [cand.action]);
    const delta = computeKpiDelta(baseline.kpis, result.kpis);

    evaluated.push({
      id: cand.id,
      action: cand.action,
      label: cand.label,
      before: baseline.kpis,
      after: result.kpis,
      delta,
    });
  }

  // Lexicographical sort
  evaluated.sort((a, b) => {
    if (a.after.strandedPax !== b.after.strandedPax) {
      return a.after.strandedPax - b.after.strandedPax;
    }
    if (a.after.crewViolations !== b.after.crewViolations) {
      return a.after.crewViolations - b.after.crewViolations;
    }
    if (a.after.totalDelayMin !== b.after.totalDelayMin) {
      return a.after.totalDelayMin - b.after.totalDelayMin;
    }
    return a.id.localeCompare(b.id);
  });

  return evaluated.slice(0, limit);
}
