/**
 * Network data loader, zod validator, and indexing structures.
 * Precomputes indices to guarantee O(flights) performance.
 */

import { z } from "zod";
import rawData from "@/data/flight_network.json";
import { parseTimeToMinutes } from "./time";
import { ENGINE_CONFIG } from "./config";
import type {
  NetworkData,
  Closure,
  Action,
  Flight,
} from "./types";

const AirportSchema = z.object({
  id: z.string().min(2),
  name: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  tier: z.enum(["mega_hub", "regional_hub", "spoke"]),
  capacity_per_hour: z.number().positive(),
});

const FlightSchema = z.object({
  flight_id: z.string(),
  tail_id: z.string(),
  leg_order: z.number().int().positive(),
  origin: z.string(),
  destination: z.string(),
  dep: z.string().regex(/^\d{2}:\d{2}$/),
  arr: z.string().regex(/^\d{2}:\d{2}$/),
  block_minutes: z.number().int().positive(),
  pax: z.number().int().nonnegative(),
  turnaround_before_min: z.number().int().nonnegative().nullable(),
});

const ConnectionSchema = z.object({
  connection_id: z.string(),
  airport: z.string(),
  from_flight: z.string(),
  to_flight: z.string(),
  passengers: z.number().int().positive(),
  min_connect_minutes: z.number().int().positive(),
});

const CrewSchema = z.object({
  crew_id: z.string(),
  tail_id: z.string(),
  base: z.string(),
  duty_start: z.string().regex(/^\d{2}:\d{2}$/),
  max_duty_mins: z.number().int().positive(),
  flight_ids: z.array(z.string()),
});

const SpareAircraftSchema = z.object({
  tail_id: z.string(),
  base: z.string(),
  available_from: z.string().regex(/^\d{2}:\d{2}$/),
  seats: z.number().int().positive(),
});

const NetworkMetaSchema = z.object({
  dataset: z.string(),
  operating_day: z.string(),
  min_turnaround_minutes: z.number().int().positive(),
  seats_per_aircraft: z.number().int().positive(),
  notes: z.array(z.string()),
});

export const NetworkDataSchema = z.object({
  meta: NetworkMetaSchema,
  airports: z.array(AirportSchema),
  flights: z.array(FlightSchema),
  connections: z.array(ConnectionSchema),
  crews: z.array(CrewSchema),
  spare_aircraft: z.array(SpareAircraftSchema),
});

/** Validated global cache of the network data */
let cachedNetwork: NetworkData | null = null;

export function loadNetworkData(): NetworkData {
  if (cachedNetwork) {
    return cachedNetwork;
  }
  const parsed = NetworkDataSchema.parse(rawData);
  cachedNetwork = parsed as NetworkData;
  return cachedNetwork;
}

/** Precomputes flight lists per aircraft tail, sorted by leg_order */
export function getTailChains(network: NetworkData): Record<string, string[]> {
  const chains: Record<string, string[]> = {};
  const sorted = [...network.flights].sort((a, b) => {
    if (a.tail_id !== b.tail_id) return a.tail_id.localeCompare(b.tail_id);
    return a.leg_order - b.leg_order;
  });

  for (const f of sorted) {
    if (!chains[f.tail_id]) {
      chains[f.tail_id] = [];
    }
    chains[f.tail_id].push(f.flight_id);
  }
  return chains;
}

/** Precomputes a map of flight_id to Flight record */
export function getFlightMap(network: NetworkData): Record<string, Flight> {
  const map: Record<string, Flight> = {};
  for (const f of network.flights) {
    map[f.flight_id] = f;
  }
  return map;
}

/** Validates closure input according to engine specification */
export function validateClosure(closure: Closure, network: NetworkData): void {
  const airportExists = network.airports.some((a) => a.id === closure.airport);
  if (!airportExists) {
    throw new Error(`Unknown airport ID in closure: ${closure.airport}`);
  }
  if (!Number.isInteger(closure.start) || !Number.isInteger(closure.end)) {
    throw new Error("Closure start and end times must be integers");
  }
  if (closure.start >= closure.end) {
    throw new Error(
      `Closure start time (${closure.start}) must be strictly before end time (${closure.end})`
    );
  }
  if (closure.start < 0) {
    throw new Error(`Closure start time cannot be negative: ${closure.start}`);
  }
  const duration = closure.end - closure.start;
  if (
    duration < ENGINE_CONFIG.CLOSURE.MIN_DURATION_MINUTES ||
    duration > ENGINE_CONFIG.CLOSURE.MAX_DURATION_MINUTES
  ) {
    throw new Error(
      `Closure duration (${duration} min) outside allowable bounds [${ENGINE_CONFIG.CLOSURE.MIN_DURATION_MINUTES}, ${ENGINE_CONFIG.CLOSURE.MAX_DURATION_MINUTES}]`
    );
  }
}

/** Validates recovery action validity according to airline operational rules */
export function validateAction(action: Action, network: NetworkData): void {
  const flightMap = getFlightMap(network);
  const flight = flightMap[action.flightId];
  if (!flight) {
    throw new Error(`Invalid action: Unknown flightId ${action.flightId}`);
  }

  if (action.type === "cancel") {
    return;
  }

  if (action.type === "spare") {
    const spare = network.spare_aircraft.find((s) => s.tail_id === action.spareTail);
    if (!spare) {
      throw new Error(`Invalid action: Unknown spare aircraft tail ${action.spareTail}`);
    }
    if (spare.base !== flight.origin) {
      throw new Error(
        `Invalid spare action: Base mismatch. Spare ${spare.tail_id} is based at ${spare.base}, but flight ${flight.flight_id} originates at ${flight.origin}`
      );
    }
    const spareAvailMin = parseTimeToMinutes(spare.available_from);
    const flightDepMin = parseTimeToMinutes(flight.dep);
    if (spareAvailMin > flightDepMin) {
      throw new Error(
        `Invalid spare action: Spare ${spare.tail_id} not available until ${spare.available_from} (${spareAvailMin}m), after scheduled departure ${flight.dep} (${flightDepMin}m)`
      );
    }
    if (spare.seats < flight.pax) {
      throw new Error(
        `Invalid spare action: Insufficient seats. Spare has ${spare.seats} seats but flight has ${flight.pax} passengers`
      );
    }
  }
}
