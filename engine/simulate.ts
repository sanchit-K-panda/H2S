/**
 * Deterministic simulation engine for Domino Sky.
 * Simulates disruption cascade across aircraft tail rotations, connections, and crews.
 * Pure TypeScript: zero dependencies on React, Next.js, fetch, or IO.
 */

import { parseTimeToMinutes } from "./time";
import { getTailChains, getFlightMap } from "./network";
import type {
  NetworkData,
  Closure,
  Action,
  Cause,
  FlightResult,
  ConnectionResult,
  CrewResult,
  Kpis,
  SimResult,
} from "./types";

/**
 * In-memory simulation cache mapping scenario keys to computed results.
 * Key format: "AIRPORT:START:END|ACTION1,ACTION2"
 */
const simulationCache = new Map<string, SimResult>();

export function clearSimulationCache(): void {
  simulationCache.clear();
}

function buildCacheKey(closure?: Closure, actions: Action[] = []): string {
  const closureKey = closure ? `${closure.airport}:${closure.start}:${closure.end}` : "none";
  const actionsKey = actions
    .map((a) => (a.type === "cancel" ? `cancel:${a.flightId}` : `spare:${a.flightId}:${a.spareTail}`))
    .sort()
    .join(",");
  return `${closureKey}|${actionsKey}`;
}

/**
 * Main simulation function.
 * Evaluates the full flight network under an optional airport closure and recovery actions.
 */
export function simulate(
  network: NetworkData,
  closure?: Closure,
  actions: Action[] = []
): SimResult {
  const cacheKey = buildCacheKey(closure, actions);
  const cached = simulationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const flightMap = getFlightMap(network);
  const tailChains = getTailChains(network);

  // Deep clone chains so modifications (e.g. spare swaps) are isolated
  const activeChains: Record<string, string[]> = {};
  for (const [tail, list] of Object.entries(tailChains)) {
    activeChains[tail] = [...list];
  }

  const cancelledFlightIds = new Set<string>();

  // Process actions: cancellations and spare aircraft assignments
  for (const act of actions) {
    if (act.type === "cancel") {
      cancelledFlightIds.add(act.flightId);
    } else if (act.type === "spare") {
      const flight = flightMap[act.flightId];
      if (flight) {
        const origTail = flight.tail_id;
        const origList = activeChains[origTail] || [];
        const splitIndex = origList.indexOf(act.flightId);
        if (splitIndex !== -1) {
          // Spare takes over from flightId onward; original tail retains prior legs
          activeChains[act.spareTail] = origList.slice(splitIndex);
          activeChains[origTail] = origList.slice(0, splitIndex);
        }
      }
    }
  }

  const flightResults: Record<string, FlightResult> = {};

  // Step 1: Simulate flights along aircraft rotation chains
  for (const [tailId, chain] of Object.entries(activeChains)) {
    let prevOperated: FlightResult | null = null;

    for (const flightId of chain) {
      const flight = flightMap[flightId];
      if (!flight) continue;

      const schedDep = parseTimeToMinutes(flight.dep);
      const schedArr = parseTimeToMinutes(flight.arr);

      // Handle cancelled flight
      if (cancelledFlightIds.has(flightId)) {
        flightResults[flightId] = {
          flightId,
          tail: tailId,
          status: "cancelled",
          schedDep,
          schedArr,
          depDelay: 0,
          arrDelay: 0,
          causes: [{ kind: "cancelled_action" }],
          causeChain: [flightId],
          crewViolation: false,
        };
        continue;
      }

      let dep = schedDep;
      const causes: Cause[] = [];
      let rootAirport: string | undefined = undefined;
      let causeChain: string[] = [];

      // If this is a spare assignment starting fresh
      const isSpareFirstLeg =
        tailId.startsWith("VT-DS17") || tailId.startsWith("VT-DS18");
      if (isSpareFirstLeg && prevOperated === null) {
        causes.push({ kind: "spare_assignment" });
      }

      // Rule: Aircraft rotation delay
      // A flight cannot depart before the previous operated flight of the same aircraft arrives
      // plus the required minimum turnaround time.
      if (prevOperated && prevOperated.actualArr !== undefined) {
        const turnaround =
          flight.turnaround_before_min ?? network.meta.min_turnaround_minutes;
        const earliestDep = prevOperated.actualArr + turnaround;
        if (earliestDep > dep) {
          dep = earliestDep;
          causes.push({
            kind: "aircraft_rotation",
            prevFlightId: prevOperated.flightId,
          });
          rootAirport = prevOperated.rootAirport;
          causeChain = [...prevOperated.causeChain, flightId];
        }
      }

      // Rule: Origin airport weather closure
      // If the departure airport is closed during the planned departure time,
      // the aircraft is held on the ground until the airport reopens.
      if (
        closure &&
        flight.origin === closure.airport &&
        dep >= closure.start &&
        dep < closure.end
      ) {
        dep = closure.end;
        causes.push({
          kind: "weather_closure",
          airport: closure.airport,
        });
        rootAirport = closure.airport;
        causeChain = [closure.airport, flightId];
      }

      // Rule: Flight block time
      // En-route flight duration is fixed by scheduled block minutes.
      let arr = dep + flight.block_minutes;

      // Rule: Destination airport weather closure
      // If the destination airport is closed when the aircraft arrives,
      // the aircraft holds in the air and lands immediately when the airport reopens.
      if (
        closure &&
        flight.destination === closure.airport &&
        arr >= closure.start &&
        arr < closure.end
      ) {
        arr = closure.end;
        causes.push({
          kind: "weather_closure",
          airport: closure.airport,
        });
        if (!rootAirport) {
          rootAirport = closure.airport;
          causeChain = [closure.airport, flightId];
        }
      }

      const depDelay = dep - schedDep;
      const arrDelay = arr - schedArr;
      const isDelayed = arrDelay > 0 || depDelay > 0;

      if (!isDelayed) {
        causeChain = [flightId];
      } else if (causeChain.length === 0) {
        causeChain = [flightId];
      }

      const res: FlightResult = {
        flightId,
        tail: tailId,
        status: isDelayed ? "delayed" : "on_time",
        schedDep,
        schedArr,
        actualDep: dep,
        actualArr: arr,
        depDelay,
        arrDelay,
        causes,
        rootAirport,
        causeChain,
        crewViolation: false,
      };

      flightResults[flightId] = res;
      prevOperated = res;
    }
  }

  // Step 2: Passenger connection analysis and stranded passenger calculation
  const connectionResults: ConnectionResult[] = [];
  let missedConnPaxBothOperated = 0;
  let bothCancelledConnPax = 0;

  for (const c of network.connections) {
    const fromRes = flightResults[c.from_flight];
    const toRes = flightResults[c.to_flight];

    if (!fromRes || !toRes) continue;

    const fromCancelled = fromRes.status === "cancelled";
    const toCancelled = toRes.status === "cancelled";

    if (fromCancelled && toCancelled) {
      bothCancelledConnPax += c.passengers;
      connectionResults.push({
        connectionId: c.connection_id,
        airport: c.airport,
        fromFlight: c.from_flight,
        toFlight: c.to_flight,
        passengers: c.passengers,
        minConnectMinutes: c.min_connect_minutes,
        status: "cancelled",
      });
    } else if (fromCancelled || toCancelled) {
      connectionResults.push({
        connectionId: c.connection_id,
        airport: c.airport,
        fromFlight: c.from_flight,
        toFlight: c.to_flight,
        passengers: c.passengers,
        minConnectMinutes: c.min_connect_minutes,
        status: "cancelled",
      });
    } else {
      // Both flights operated
      const connectionWindow =
        (toRes.actualDep ?? toRes.schedDep) -
        (fromRes.actualArr ?? fromRes.schedArr);
      const isMade = connectionWindow >= c.min_connect_minutes;

      if (!isMade) {
        missedConnPaxBothOperated += c.passengers;
      }

      connectionResults.push({
        connectionId: c.connection_id,
        airport: c.airport,
        fromFlight: c.from_flight,
        toFlight: c.to_flight,
        passengers: c.passengers,
        minConnectMinutes: c.min_connect_minutes,
        status: isMade ? "made" : "missed",
        connectionWindowMinutes: connectionWindow,
      });
    }
  }

  // Stranded passengers formula per spec:
  // strandedPax = Σ pax(cancelled) + Σ c.passengers(missed, both operated) - Σ c.passengers(both cancelled)
  let cancelledPaxTotal = 0;
  for (const fid of cancelledFlightIds) {
    const f = flightMap[fid];
    if (f) cancelledPaxTotal += f.pax;
  }

  const strandedPax =
    cancelledPaxTotal + missedConnPaxBothOperated - bothCancelledConnPax;

  // Step 3: Crew legal duty hours validation
  const crewResults: CrewResult[] = [];
  let crewViolationCount = 0;

  for (const crew of network.crews) {
    const dutyStart = parseTimeToMinutes(crew.duty_start);
    const operatedFlights = crew.flight_ids
      .map((fid) => flightResults[fid])
      .filter((fr): fr is FlightResult => fr !== undefined && fr.status !== "cancelled");

    if (operatedFlights.length === 0) {
      crewResults.push({
        crewId: crew.crew_id,
        base: crew.base,
        dutyStart,
        dutyEnd: dutyStart,
        dutyMinutes: 0,
        maxDutyMinutes: crew.max_duty_mins,
        isViolation: false,
        overByMinutes: 0,
      });
      continue;
    }

    const dutyEnd = Math.max(
      ...operatedFlights.map((fr) => fr.actualArr ?? fr.schedArr)
    );
    const dutyMinutes = dutyEnd - dutyStart;
    const isViolation = dutyMinutes > crew.max_duty_mins;
    const overByMinutes = isViolation ? dutyMinutes - crew.max_duty_mins : 0;

    let violatingFlightId: string | undefined = undefined;
    if (isViolation) {
      crewViolationCount += 1;
      // Identify the first flight whose arrival exceeds the limit
      for (const fr of operatedFlights) {
        if ((fr.actualArr ?? fr.schedArr) - dutyStart > crew.max_duty_mins) {
          violatingFlightId = fr.flightId;
          fr.crewViolation = true;
          break;
        }
      }
    }

    crewResults.push({
      crewId: crew.crew_id,
      base: crew.base,
      dutyStart,
      dutyEnd,
      dutyMinutes,
      maxDutyMinutes: crew.max_duty_mins,
      isViolation,
      overByMinutes,
      violatingFlightId,
    });
  }

  // Step 4: KPI aggregations
  const allResultsList = Object.values(flightResults);
  const delayedFlightsCount = allResultsList.filter(
    (r) => r.status !== "cancelled" && r.arrDelay > 0
  ).length;

  const totalDelayMinutes = allResultsList
    .filter((r) => r.status !== "cancelled" && r.arrDelay > 0)
    .reduce((sum, r) => sum + r.arrDelay, 0);

  const kpis: Kpis = {
    delayedFlights: delayedFlightsCount,
    cancelledFlights: cancelledFlightIds.size,
    totalDelayMin: totalDelayMinutes,
    strandedPax,
    crewViolations: crewViolationCount,
  };

  const simResult: SimResult = {
    flights: flightResults,
    flightList: allResultsList,
    connections: connectionResults,
    crews: crewResults,
    kpis,
    closure,
    actionsApplied: actions,
  };

  simulationCache.set(cacheKey, simResult);
  return simResult;
}
