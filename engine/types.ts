/**
 * Core type definitions for the Domino Sky simulation engine.
 * Pure TypeScript types with zero dependencies on external frameworks or UI libraries.
 */

export interface Airport {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tier: "mega_hub" | "regional_hub" | "spoke";
  capacity_per_hour: number;
}

export interface Flight {
  flight_id: string;
  tail_id: string;
  leg_order: number;
  origin: string;
  destination: string;
  dep: string; // HH:MM
  arr: string; // HH:MM
  block_minutes: number;
  pax: number;
  turnaround_before_min: number | null;
}

export interface Connection {
  connection_id: string;
  airport: string;
  from_flight: string;
  to_flight: string;
  passengers: number;
  min_connect_minutes: number;
}

export interface Crew {
  crew_id: string;
  tail_id: string;
  base: string;
  duty_start: string; // HH:MM
  max_duty_mins: number;
  flight_ids: string[];
}

export interface SpareAircraft {
  tail_id: string;
  base: string;
  available_from: string; // HH:MM
  seats: number;
}

export interface NetworkMeta {
  dataset: string;
  operating_day: string;
  min_turnaround_minutes: number;
  seats_per_aircraft: number;
  notes: string[];
}

export interface NetworkData {
  meta: NetworkMeta;
  airports: Airport[];
  flights: Flight[];
  connections: Connection[];
  crews: Crew[];
  spare_aircraft: SpareAircraft[];
}

export interface Closure {
  airport: string;
  start: number; // minute of day [0, 1440+]
  end: number;   // minute of day, start < end
}

export type Action =
  | { type: "cancel"; flightId: string }
  | { type: "spare"; flightId: string; spareTail: string };

export type Cause =
  | { kind: "weather_closure"; airport: string }
  | { kind: "aircraft_rotation"; prevFlightId: string }
  | { kind: "spare_assignment" }
  | { kind: "cancelled_action" };

export interface FlightResult {
  flightId: string;
  tail: string;
  status: "on_time" | "delayed" | "cancelled";
  schedDep: number;
  schedArr: number;
  actualDep?: number;
  actualArr?: number;
  depDelay: number;
  arrDelay: number;
  causes: Cause[];
  rootAirport?: string;
  causeChain: string[];
  crewViolation: boolean;
}

export interface ConnectionResult {
  connectionId: string;
  airport: string;
  fromFlight: string;
  toFlight: string;
  passengers: number;
  minConnectMinutes: number;
  status: "made" | "missed" | "cancelled";
  connectionWindowMinutes?: number;
}

export interface CrewResult {
  crewId: string;
  base: string;
  dutyStart: number;
  dutyEnd: number;
  dutyMinutes: number;
  maxDutyMinutes: number;
  isViolation: boolean;
  overByMinutes: number;
  violatingFlightId?: string;
}

export interface Kpis {
  delayedFlights: number;
  cancelledFlights: number;
  totalDelayMin: number;
  strandedPax: number;
  crewViolations: number;
}

export interface SimResult {
  flights: Record<string, FlightResult>;
  flightList: FlightResult[];
  connections: ConnectionResult[];
  crews: CrewResult[];
  kpis: Kpis;
  closure?: Closure;
  actionsApplied: Action[];
}

export interface RecoveryDelta {
  delayedFlights: number;
  cancelledFlights: number;
  totalDelayMin: number;
  strandedPax: number;
  crewViolations: number;
}

export interface RecoveryOption {
  id: string; // e.g. "spare:DS0502:VT-DS17" or "cancel:DS0101"
  action: Action;
  label: string;
  before: Kpis;
  after: Kpis;
  delta: RecoveryDelta;
}
