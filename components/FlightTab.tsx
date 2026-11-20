"use client";

import React from "react";
import type {
  FlightResult,
  Flight,
  ConnectionResult,
  CrewResult,
} from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Plane,
  CloudRain,
  ArrowRight,
  Clock,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
} from "lucide-react";

interface FlightTabProps {
  flightId?: string;
  flightResult?: FlightResult;
  rawFlight?: Flight;
  connections: ConnectionResult[];
  crew?: CrewResult;
  onSelectFlight: (id: string) => void;
}

export function FlightTab({
  flightId,
  flightResult,
  rawFlight,
  connections,
  crew,
  onSelectFlight,
}: FlightTabProps) {
  if (!flightId || !flightResult || !rawFlight) {
    return (
      <div className="rounded-card border border-skyborder bg-white p-6 text-center text-xs text-skymuted">
        <Plane className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="font-semibold text-skytext">No flight selected</p>
        <p className="mt-1 text-[11px]">
          Click any flight in the Timeline, Map, or Table to diagnose its cause chain and crew duty.
        </p>
      </div>
    );
  }

  const isDelayed = flightResult.arrDelay > 0;
  const isCancelled = flightResult.status === "cancelled";
  const isSpareOperated = flightResult.tail !== rawFlight.tail_id;

  // Connections involving this flight
  const outboundConns = connections.filter((c) => c.fromFlight === flightId);
  const inboundConns = connections.filter((c) => c.toFlight === flightId);

  // Crew duty percentage
  const dutyPct = crew ? Math.min(100, (crew.dutyMinutes / crew.maxDutyMinutes) * 100) : 0;
  const isCrewNearLimit = dutyPct >= 90;
  const isCrewOverLimit = crew?.isViolation ?? false;

  return (
    <div className="space-y-4">
      {/* Flight Header Card */}
      <Card className="border-skyborder bg-white shadow-subtle p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-navy">
                {flightId}
              </span>
              <span className="text-xs font-semibold text-skytext">
                {rawFlight.origin} → {rawFlight.destination}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] font-mono text-skymuted">
              Tail: {flightResult.tail} · Leg #{rawFlight.leg_order} · {rawFlight.pax} Pax
            </p>
          </div>

          <div>
            {isCancelled ? (
              <Badge variant="cancelled">Cancelled</Badge>
            ) : isDelayed ? (
              <Badge variant={flightResult.arrDelay > 60 ? "severe" : "minor"}>
                +{flightResult.arrDelay}m Late
              </Badge>
            ) : (
              <Badge variant="ontime">On Time</Badge>
            )}
          </div>
        </div>

        {/* Timing Summary */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-control bg-slate-50 p-2.5 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-skymuted">
              Departure
            </span>
            <div className="mt-0.5 font-mono text-skytext">
              <span className="text-skymuted">Sched: </span>
              {formatMinutesToTime(flightResult.schedDep)}
            </div>
            <div className="font-mono font-bold text-navy">
              <span className="text-skymuted font-normal">Act: </span>
              {flightResult.actualDep !== undefined
                ? formatMinutesToTime(flightResult.actualDep)
                : "Cancelled"}
              {flightResult.depDelay > 0 && (
                <span className="ml-1 text-status-minor text-[11px]">
                  (+{flightResult.depDelay}m)
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-skymuted">
              Arrival
            </span>
            <div className="mt-0.5 font-mono text-skytext">
              <span className="text-skymuted">Sched: </span>
              {formatMinutesToTime(flightResult.schedArr)}
            </div>
            <div className="font-mono font-bold text-navy">
              <span className="text-skymuted font-normal">Act: </span>
              {flightResult.actualArr !== undefined
                ? formatMinutesToTime(flightResult.actualArr)
                : "Cancelled"}
              {flightResult.arrDelay > 0 && (
                <span className="ml-1 text-status-severe text-[11px]">
                  (+{flightResult.arrDelay}m)
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Cause Chain Vertical Stepper */}
      <Card className="border-skyborder bg-white shadow-subtle p-4">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5 border-b border-skyborder/60 pb-2">
          <Clock className="h-4 w-4 text-skyaccent" />
          Delay Cause Chain Diagnostics
        </h4>

        {flightResult.causeChain && flightResult.causeChain.length > 0 ? (
          <div className="mt-3 relative pl-4 border-l-2 border-skyborder space-y-4">
            {flightResult.causeChain.map((node, idx) => {
              const isRoot = idx === 0;
              const isTarget = idx === flightResult.causeChain.length - 1;
              const isAirport = node.length === 3 && node === node.toUpperCase();

              return (
                <div key={`${node}-${idx}`} className="relative group">
                  {/* Step bullet */}
                  <span
                    className={`absolute -left-[21px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                      isRoot
                        ? "bg-status-severe"
                        : isTarget
                        ? "bg-skyaccent"
                        : "bg-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="text-xs">
                    <div className="flex items-center gap-1.5">
                      {isAirport ? (
                        <>
                          <CloudRain className="h-3.5 w-3.5 text-status-severe" />
                          <span className="font-bold text-navy">
                            Airport Weather Closure at {node}
                          </span>
                        </>
                      ) : (
                        <>
                          <Plane className="h-3.5 w-3.5 text-skyaccent" />
                          <button
                            type="button"
                            onClick={() => onSelectFlight(node)}
                            className="font-mono font-bold text-skyaccent hover:underline"
                          >
                            Flight {node}
                          </button>
                          {node === flightId && (
                            <span className="text-[10px] text-skymuted font-medium">
                              (Current Leg)
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <p className="mt-0.5 text-[11px] text-skymuted">
                      {isRoot
                        ? `Initial weather disruption held departing flights.`
                        : isTarget
                        ? isSpareOperated
                          ? `Operated by spare aircraft ${flightResult.tail}.`
                          : `Inherited arrival delay through aircraft turnaround buffer.`
                        : `Turnaround delay cascaded to subsequent rotation leg.`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-status-ontime font-medium">
            Flight operated on schedule without upstream cascade delays.
          </p>
        )}
      </Card>

      {/* Passenger Connections Card */}
      <Card className="border-skyborder bg-white shadow-subtle p-4">
        <h4 className="text-xs font-bold text-navy flex items-center justify-between border-b border-skyborder/60 pb-2">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-skyaccent" />
            Connecting Passenger Itineraries
          </span>
          <span className="font-mono text-[11px] text-skymuted">
            {outboundConns.length + inboundConns.length} transfers
          </span>
        </h4>

        {outboundConns.length === 0 && inboundConns.length === 0 ? (
          <p className="mt-2 text-xs text-skymuted">
            No connecting passenger itineraries on this leg.
          </p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {outboundConns.map((conn) => (
              <div
                key={conn.connectionId}
                className={`flex items-center justify-between rounded-control border p-2 text-xs ${
                  conn.status === "missed"
                    ? "border-status-severe/40 bg-status-severe-bg"
                    : conn.status === "cancelled"
                    ? "border-slate-300 bg-slate-100"
                    : "border-skyborder bg-slate-50/60"
                }`}
              >
                <div>
                  <span className="font-mono font-bold text-navy">
                    {conn.connectionId}:
                  </span>{" "}
                  Transfer to{" "}
                  <button
                    type="button"
                    onClick={() => onSelectFlight(conn.toFlight)}
                    className="font-mono font-bold text-skyaccent hover:underline"
                  >
                    {conn.toFlight}
                  </button>{" "}
                  ({conn.passengers} pax)
                </div>

                <div>
                  {conn.status === "missed" ? (
                    <Badge variant="severe">MISSED</Badge>
                  ) : conn.status === "cancelled" ? (
                    <Badge variant="cancelled">CANCELLED</Badge>
                  ) : (
                    <Badge variant="ontime">MADE</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Crew Legal Duty Hours */}
      <Card className="border-skyborder bg-white shadow-subtle p-4">
        <h4 className="text-xs font-bold text-navy flex items-center gap-1.5 border-b border-skyborder/60 pb-2">
          {isCrewOverLimit ? (
            <UserX className="h-4 w-4 text-status-severe" />
          ) : (
            <UserCheck className="h-4 w-4 text-skyaccent" />
          )}
          Assigned Crew Roster
        </h4>

        {crew ? (
          <div className="mt-2.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-navy">
                Crew {crew.crewId} (Base: {crew.base})
              </span>
              <span className="font-mono font-bold">
                {crew.dutyMinutes} / {crew.maxDutyMinutes}m
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${
                  isCrewOverLimit
                    ? "bg-status-severe"
                    : isCrewNearLimit
                    ? "bg-status-minor"
                    : "bg-status-ontime"
                }`}
                style={{ width: `${Math.min(100, dutyPct)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-skymuted">
              <span>Duty Start: {formatMinutesToTime(crew.dutyStart)}</span>
              {isCrewOverLimit ? (
                <span className="font-bold text-status-severe">
                  OVERRUN: +{crew.overByMinutes}m
                </span>
              ) : (
                <span>Legal limit: 600m</span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-skymuted">
            No crew roster information recorded.
          </p>
        )}
      </Card>
    </div>
  );
}
