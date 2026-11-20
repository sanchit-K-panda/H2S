import { describe, it, expect, beforeEach } from "vitest";
import {
  loadNetworkData,
  simulate,
  generateRecoveryOptions,
  validateAction,
  clearSimulationCache,
} from "@/engine";
import type { Closure } from "@/engine/types";

describe("Engine Edge Cases & Advanced Scenarios", () => {
  const network = loadNetworkData();

  beforeEach(() => {
    clearSimulationCache();
  });

  it("handles minimum allowable closure duration (15 minutes) cleanly", () => {
    const closure: Closure = { airport: "BOM", start: 480, end: 495 };
    const result = simulate(network, closure);
    expect(result.kpis.delayedFlights).toBeGreaterThan(0);
    expect(result.kpis.cancelledFlights).toBe(0);
  });

  it("handles maximum allowable closure duration (360 minutes / 6 hours)", () => {
    const closure: Closure = { airport: "DEL", start: 360, end: 720 };
    const result = simulate(network, closure);
    expect(result.kpis.delayedFlights).toBeGreaterThan(10);
    expect(result.kpis.totalDelayMin).toBeGreaterThan(1000);
  });

  it("evaluates recovery options for high-severity closures without crashing", () => {
    const closure: Closure = { airport: "BLR", start: 600, end: 840 };
    const options = generateRecoveryOptions(network, closure, 5);
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options.length).toBeLessThanOrEqual(5);

    // Sorted descending by benefit (strandedPax saved first)
    for (let i = 0; i < options.length - 1; i++) {
      const a = options[i];
      const b = options[i + 1];
      expect(a.delta.strandedPax).toBeLessThanOrEqual(b.delta.strandedPax);
    }
  });

  it("flags crew violation with accurate positive overByMinutes", () => {
    const closure: Closure = { airport: "BOM", start: 480, end: 600 };
    const result = simulate(network, closure);
    const violations = result.crews.filter((c) => c.isViolation);
    expect(violations.length).toBe(2);
    for (const v of violations) {
      expect(v.overByMinutes).toBe(v.dutyMinutes - v.maxDutyMinutes);
      expect(v.overByMinutes).toBeGreaterThan(0);
    }
  });

  it("preserves untouched aircraft tails with zero delay", () => {
    const closure: Closure = { airport: "TRV", start: 720, end: 780 };
    const result = simulate(network, closure);

    // VT-DS01 operates entirely in North India (DEL-JAI-DEL-LKO-DEL-IXC) and should not be affected by TRV closure
    const northFlights = result.flightList.filter((f) => f.tail === "VT-DS01");
    for (const f of northFlights) {
      expect(f.arrDelay).toBe(0);
      expect(f.status).toBe("on_time");
    }
  });

  it("validates that spare aircraft cannot be assigned to flight at different airport", () => {
    // VT-DS18 is stationed at DEL. Attempting to assign to BOM flight fails validation
    expect(() =>
      validateAction(
        { type: "spare", flightId: "DS0501", spareTail: "VT-DS18" },
        network
      )
    ).toThrow(/Base mismatch/);
  });
});
