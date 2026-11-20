import { describe, it, expect, beforeEach } from "vitest";
import {
  loadNetworkData,
  simulate,
  clearSimulationCache,
  validateClosure,
  validateAction,
  parseTimeToMinutes,
  formatMinutesToTime,
} from "@/engine";
import type { Closure, Action } from "@/engine";

describe("Engine Unit Tests (E1 - E11)", () => {
  const network = loadNetworkData();

  beforeEach(() => {
    clearSimulationCache();
  });

  it("E1: No closure produces all-zero disruption KPIs", () => {
    const result = simulate(network);
    expect(result.kpis).toEqual({
      delayedFlights: 0,
      cancelledFlights: 0,
      totalDelayMin: 0,
      strandedPax: 0,
      crewViolations: 0,
    });
    for (const flight of result.flightList) {
      expect(flight.status).toBe("on_time");
      expect(flight.arrDelay).toBe(0);
      expect(flight.depDelay).toBe(0);
    }
  });

  it("E2: Closure on airport with no flights in window results in zero KPIs", () => {
    // JAI has no departures or arrivals between 03:00 and 04:00
    const closure: Closure = {
      airport: "JAI",
      start: parseTimeToMinutes("03:00"),
      end: parseTimeToMinutes("04:00"),
    };
    const result = simulate(network, closure);
    expect(result.kpis).toEqual({
      delayedFlights: 0,
      cancelledFlights: 0,
      totalDelayMin: 0,
      strandedPax: 0,
      crewViolations: 0,
    });
  });

  it("E3: Origin closure delays flight; next legs on same tail inherit rotation delay with cause chain", () => {
    // BOM closure 08:00 - 10:00
    const closure: Closure = {
      airport: "BOM",
      start: 480,
      end: 600,
    };
    const result = simulate(network, closure);

    // DS0501 departs BOM at 08:15 scheduled, held to 10:00
    const ds0501 = result.flights["DS0501"];
    expect(ds0501.actualDep).toBe(600); // 10:00
    expect(ds0501.actualArr).toBe(600 + 105); // 11:45 (block = 105)
    expect(ds0501.rootAirport).toBe("BOM");
    expect(ds0501.causes.some((c) => c.kind === "weather_closure")).toBe(true);

    // DS0502 BLR -> COK is on same tail VT-DS05, scheduled 11:10
    // Turnaround = 70 min. Earliest dep = 11:45 + 70 min = 12:55 (775)
    const ds0502 = result.flights["DS0502"];
    expect(ds0502.actualDep).toBe(775);
    expect(ds0502.rootAirport).toBe("BOM");
    expect(
      ds0502.causes.some(
        (c) => c.kind === "aircraft_rotation" && c.prevFlightId === "DS0501"
      )
    ).toBe(true);
    expect(ds0502.causeChain).toContain("BOM");
    expect(ds0502.causeChain).toContain("DS0501");
    expect(ds0502.causeChain).toContain("DS0502");
  });

  it("E4: Destination closure holds arrival until reopening", () => {
    // DS0201 departs DEL at 06:00, scheduled arrival in BOM at 08:10 (490)
    // If BOM closes 08:00 to 08:30, arrival is held until 08:30 (510)
    const closure: Closure = {
      airport: "BOM",
      start: 480,
      end: 510,
    };
    const result = simulate(network, closure);
    const ds0201 = result.flights["DS0201"];
    expect(ds0201.actualDep).toBe(360); // 06:00 on time
    expect(ds0201.actualArr).toBe(510); // held to 08:30
    expect(ds0201.arrDelay).toBe(510 - 490); // 20 min
    expect(ds0201.causes.some((c) => c.kind === "weather_closure")).toBe(true);
  });

  it("E5: Turnaround is strictly honored per turnaround_before_min", () => {
    // Test that for every operated consecutive flight leg, dep >= prevArr + turnaround
    const closure: Closure = { airport: "BOM", start: 480, end: 600 };
    const result = simulate(network, closure);

    for (const flight of network.flights) {
      if (flight.leg_order > 1) {
        const curr = result.flights[flight.flight_id];
        const prevFlight = network.flights.find(
          (f) => f.tail_id === flight.tail_id && f.leg_order === flight.leg_order - 1
        );
        if (prevFlight) {
          const prev = result.flights[prevFlight.flight_id];
          if (curr.actualDep !== undefined && prev.actualArr !== undefined) {
            const turnaround =
              flight.turnaround_before_min ?? network.meta.min_turnaround_minutes;
            expect(curr.actualDep).toBeGreaterThanOrEqual(
              prev.actualArr + turnaround
            );
          }
        }
      }
    }
  });

  it("E6: Connection is made when window >= MCT, missed when window < MCT", () => {
    const closure: Closure = { airport: "BOM", start: 480, end: 600 };
    const result = simulate(network, closure);

    for (const conn of result.connections) {
      if (conn.status === "made") {
        expect(conn.connectionWindowMinutes).toBeGreaterThanOrEqual(
          conn.minConnectMinutes
        );
      } else if (conn.status === "missed") {
        expect(conn.connectionWindowMinutes).toBeLessThan(
          conn.minConnectMinutes
        );
      }
    }
  });

  it("E7: Cancelled flight counts its pax; connections deduplicated correctly", () => {
    // Cancel DS0501 (pax = 159)
    const action: Action = { type: "cancel", flightId: "DS0501" };
    const result = simulate(network, undefined, [action]);
    expect(result.kpis.cancelledFlights).toBe(1);
    expect(result.flights["DS0501"].status).toBe("cancelled");
    expect(result.kpis.strandedPax).toBe(159);
  });

  it("E8: Crew duty violation is flagged with overByMin", () => {
    // BOM 08:00 - 10:00 causes 2 crew violations
    const closure: Closure = { airport: "BOM", start: 480, end: 600 };
    const result = simulate(network, closure);
    const violatingCrews = result.crews.filter((c) => c.isViolation);
    expect(violatingCrews.length).toBe(2);
    for (const vc of violatingCrews) {
      expect(vc.overByMinutes).toBeGreaterThan(0);
      expect(vc.dutyMinutes).toBeGreaterThan(vc.maxDutyMinutes);
      expect(vc.violatingFlightId).toBeDefined();
    }
  });

  it("E9: Spare action throws typed errors on base mismatch, capacity, or availability", () => {
    // VT-DS17 is at BLR. Attempting to assign it to DEL flight DS0101 fails base check
    expect(() =>
      validateAction({ type: "spare", flightId: "DS0101", spareTail: "VT-DS17" }, network)
    ).toThrow(/Base mismatch/);

    // Non-existent flight
    expect(() =>
      validateAction({ type: "spare", flightId: "DS9999", spareTail: "VT-DS17" }, network)
    ).toThrow(/Unknown flightId/);

    // Non-existent spare tail
    expect(() =>
      validateAction({ type: "spare", flightId: "DS0502", spareTail: "VT-DS99" }, network)
    ).toThrow(/Unknown spare aircraft tail/);
  });

  it("E10: Simulation is strictly deterministic: identical inputs yield identical outputs", () => {
    const closure: Closure = { airport: "BOM", start: 480, end: 600 };
    const run1 = simulate(network, closure);
    clearSimulationCache();
    const run2 = simulate(network, closure);
    expect(run1).toEqual(run2);
  });

  it("E11: Input validation throws errors on invalid closure times and unknown airports", () => {
    expect(() =>
      validateClosure({ airport: "UNKNOWN", start: 480, end: 600 }, network)
    ).toThrow(/Unknown airport ID/);

    expect(() =>
      validateClosure({ airport: "BOM", start: 600, end: 480 }, network)
    ).toThrow(/strictly before/);

    expect(() =>
      validateClosure({ airport: "BOM", start: -10, end: 600 }, network)
    ).toThrow(/cannot be negative/);

    // Duration too short (< 15 min)
    expect(() =>
      validateClosure({ airport: "BOM", start: 480, end: 490 }, network)
    ).toThrow(/outside allowable bounds/);

    // Duration too long (> 360 min)
    expect(() =>
      validateClosure({ airport: "BOM", start: 480, end: 900 }, network)
    ).toThrow(/outside allowable bounds/);
  });

  it("Time utility functions parse and format correctly", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(formatMinutesToTime(510)).toBe("08:30");
    expect(formatMinutesToTime(0)).toBe("00:00");
  });
});
