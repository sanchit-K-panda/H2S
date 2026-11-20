import { describe, it, expect, beforeEach } from "vitest";
import { loadNetworkData, simulate, clearSimulationCache } from "@/engine";
import type { Closure, Kpis } from "@/engine";

describe("Engine Golden Scenarios (docs/05-TEST-PLAN.md)", () => {
  const network = loadNetworkData();

  beforeEach(() => {
    clearSimulationCache();
  });

  const goldenScenarios: {
    name: string;
    closure?: Closure;
    expected: Kpis;
  }[] = [
    {
      name: "Baseline: no closure",
      closure: undefined,
      expected: {
        delayedFlights: 0,
        cancelledFlights: 0,
        totalDelayMin: 0,
        strandedPax: 0,
        crewViolations: 0,
      },
    },
    {
      name: "BOM 08:00–10:00 (Main demo)",
      closure: { airport: "BOM", start: 480, end: 600 },
      expected: {
        delayedFlights: 17,
        cancelledFlights: 0,
        totalDelayMin: 1550,
        strandedPax: 115,
        crewViolations: 2,
      },
    },
    {
      name: "BOM 11:00–13:00",
      closure: { airport: "BOM", start: 660, end: 780 },
      expected: {
        delayedFlights: 5,
        cancelledFlights: 0,
        totalDelayMin: 385,
        strandedPax: 0,
        crewViolations: 1,
      },
    },
    {
      name: "BOM 14:00–15:30",
      closure: { airport: "BOM", start: 840, end: 930 },
      expected: {
        delayedFlights: 1,
        cancelledFlights: 0,
        totalDelayMin: 45,
        strandedPax: 0,
        crewViolations: 0,
      },
    },
    {
      name: "DEL 08:00–10:00",
      closure: { airport: "DEL", start: 480, end: 600 },
      expected: {
        delayedFlights: 9,
        cancelledFlights: 0,
        totalDelayMin: 780,
        strandedPax: 37,
        crewViolations: 1,
      },
    },
    {
      name: "DEL 11:00–13:00",
      closure: { airport: "DEL", start: 660, end: 780 },
      expected: {
        delayedFlights: 12,
        cancelledFlights: 0,
        totalDelayMin: 805,
        strandedPax: 0,
        crewViolations: 2,
      },
    },
    {
      name: "DEL 14:00–15:30",
      closure: { airport: "DEL", start: 840, end: 930 },
      expected: {
        delayedFlights: 7,
        cancelledFlights: 0,
        totalDelayMin: 475,
        strandedPax: 51,
        crewViolations: 2,
      },
    },
    {
      name: "BLR 08:00–10:00",
      closure: { airport: "BLR", start: 480, end: 600 },
      expected: {
        delayedFlights: 4,
        cancelledFlights: 0,
        totalDelayMin: 340,
        strandedPax: 67,
        crewViolations: 0,
      },
    },
    {
      name: "BLR 11:00–13:00",
      closure: { airport: "BLR", start: 660, end: 780 },
      expected: {
        delayedFlights: 7,
        cancelledFlights: 0,
        totalDelayMin: 460,
        strandedPax: 69,
        crewViolations: 0,
      },
    },
    {
      name: "BLR 14:00–15:00",
      closure: { airport: "BLR", start: 840, end: 900 },
      expected: {
        delayedFlights: 11,
        cancelledFlights: 0,
        totalDelayMin: 360,
        strandedPax: 19,
        crewViolations: 1,
      },
    },
    {
      name: "BLR 14:00–15:30",
      closure: { airport: "BLR", start: 840, end: 930 },
      expected: {
        delayedFlights: 15,
        cancelledFlights: 0,
        totalDelayMin: 770,
        strandedPax: 19,
        crewViolations: 1,
      },
    },
  ];

  for (const tc of goldenScenarios) {
    it(`Matches reference sim on ${tc.name}`, () => {
      const result = simulate(network, tc.closure);
      expect(result.kpis).toEqual(tc.expected);
    });
  }
});
