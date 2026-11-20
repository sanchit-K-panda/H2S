import { describe, it, expect, beforeEach } from "vitest";
import {
  loadNetworkData,
  simulate,
  generateCandidates,
  generateRecoveryOptions,
  clearSimulationCache,
} from "@/engine";
import type { Closure } from "@/engine";

describe("Recovery Engine Tests (docs/05-TEST-PLAN.md)", () => {
  const network = loadNetworkData();
  const bomClosure: Closure = { airport: "BOM", start: 480, end: 600 };

  beforeEach(() => {
    clearSimulationCache();
  });

  it("Generates exactly 92 candidate recovery actions (70 cancels + 22 valid spares)", () => {
    const candidates = generateCandidates(network);
    expect(candidates.length).toBe(92);

    const cancels = candidates.filter((c) => c.action.type === "cancel");
    const spares = candidates.filter((c) => c.action.type === "spare");

    expect(cancels.length).toBe(70);
    expect(spares.length).toBe(22);
  });

  it("Matches golden recovery recommendations for BOM 08:00–10:00", () => {
    const options = generateRecoveryOptions(network, bomClosure, 3);
    expect(options.length).toBe(3);

    // Best option must be spare VT-DS17 on DS0502
    const best = options[0];
    expect(best.id).toBe("spare:DS0502:VT-DS17");
    expect(best.action).toEqual({
      type: "spare",
      flightId: "DS0502",
      spareTail: "VT-DS17",
    });
    expect(best.before).toEqual({
      delayedFlights: 17,
      cancelledFlights: 0,
      totalDelayMin: 1550,
      strandedPax: 115,
      crewViolations: 2,
    });
    expect(best.after).toEqual({
      delayedFlights: 14,
      cancelledFlights: 0,
      totalDelayMin: 1235,
      strandedPax: 71,
      crewViolations: 2,
    });
    expect(best.delta).toEqual({
      delayedFlights: -3,
      cancelledFlights: 0,
      totalDelayMin: -315,
      strandedPax: -44,
      crewViolations: 0,
    });

    // Runner up must be spare VT-DS17 on DS0704
    const runnerUp = options[1];
    expect(runnerUp.id).toBe("spare:DS0704:VT-DS17");
    expect(runnerUp.after.strandedPax).toBe(92);
    expect(runnerUp.after.totalDelayMin).toBe(1500);
    expect(runnerUp.after.crewViolations).toBe(2);
  });

  it("Verifies after KPIs independently match a dedicated single-action simulation", () => {
    const options = generateRecoveryOptions(network, bomClosure, 3);
    for (const opt of options) {
      const independentSim = simulate(network, bomClosure, [opt.action]);
      expect(opt.after).toEqual(independentSim.kpis);
    }
  });

  it("Recovery ranking is strictly lexicographic (stranded asc, crewViol asc, totalDelay asc, id asc)", () => {
    const options = generateRecoveryOptions(network, bomClosure, 5);
    for (let i = 0; i < options.length - 1; i++) {
      const a = options[i];
      const b = options[i + 1];

      if (a.after.strandedPax === b.after.strandedPax) {
        if (a.after.crewViolations === b.after.crewViolations) {
          if (a.after.totalDelayMin === b.after.totalDelayMin) {
            expect(a.id.localeCompare(b.id)).toBeLessThanOrEqual(0);
          } else {
            expect(a.after.totalDelayMin).toBeLessThanOrEqual(b.after.totalDelayMin);
          }
        } else {
          expect(a.after.crewViolations).toBeLessThanOrEqual(b.after.crewViolations);
        }
      } else {
        expect(a.after.strandedPax).toBeLessThanOrEqual(b.after.strandedPax);
      }
    }
  });
});
