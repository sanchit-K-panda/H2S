"use client";

import React from "react";
import type { FlightResult, Flight, ConnectionResult, CrewResult } from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";

interface FlightDetailProps {
  flightId?: string;
  flightResult?: FlightResult;
  rawFlight?: Flight;
  connections: ConnectionResult[];
  crew?: CrewResult;
  onClose?: () => void;
  onSelectRelatedFlight?: (flightId: string) => void;
}

export function FlightDetail({
  flightId,
  flightResult,
  rawFlight,
  connections,
  crew,
  onClose,
  onSelectRelatedFlight,
}: FlightDetailProps) {
  if (!flightId || !flightResult || !rawFlight) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Flight Diagnostics
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Click any flight in the table, timeline, or map to inspect its root-cause chain, passenger connections, and crew duty status.
        </p>
      </div>
    );
  }

  const isDelayed = flightResult.arrDelay > 0 || flightResult.depDelay > 0;
  const isCancelled = flightResult.status === "cancelled";

  // Connections involving this flight
  const inboundConnections = connections.filter((c) => c.toFlight === flightId);
  const outboundConnections = connections.filter((c) => c.fromFlight === flightId);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold font-mono text-slate-900">
              {flightId}
            </h2>
            <span className="text-sm font-semibold text-slate-700">
              {rawFlight.origin} → {rawFlight.destination}
            </span>
            {isCancelled ? (
              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 ring-1 ring-purple-600/20">
                Cancelled
              </span>
            ) : isDelayed ? (
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-600/20">
                +{flightResult.arrDelay}m Delayed
              </span>
            ) : (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                On Schedule
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 font-mono">
            Aircraft Tail: {flightResult.tail} • Leg #{rawFlight.leg_order} • {rawFlight.pax} Passengers
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close flight detail drawer"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            ✕
          </button>
        )}
      </div>

      {/* Flight Timings Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50/70 p-3 text-xs">
        <div>
          <span className="text-slate-500">Scheduled Departure:</span>
          <div className="font-mono font-semibold text-slate-800">
            {formatMinutesToTime(flightResult.schedDep)}
          </div>
          <span className="mt-1 block text-slate-500">Actual Departure:</span>
          <div className="font-mono font-bold text-slate-900">
            {flightResult.actualDep !== undefined
              ? formatMinutesToTime(flightResult.actualDep)
              : "Cancelled"}
            {flightResult.depDelay > 0 && (
              <span className="ml-1 text-amber-700 font-semibold">
                (+{flightResult.depDelay}m)
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="text-slate-500">Scheduled Arrival:</span>
          <div className="font-mono font-semibold text-slate-800">
            {formatMinutesToTime(flightResult.schedArr)}
          </div>
          <span className="mt-1 block text-slate-500">Actual Arrival:</span>
          <div className="font-mono font-bold text-slate-900">
            {flightResult.actualArr !== undefined
              ? formatMinutesToTime(flightResult.actualArr)
              : "Cancelled"}
            {flightResult.arrDelay > 0 && (
              <span className="ml-1 text-rose-700 font-semibold">
                (+{flightResult.arrDelay}m)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ordered Cause Chain: Why is this flight late? */}
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Root Cause Chain: Why is {flightId} late?
        </h3>
        {flightResult.causeChain && flightResult.causeChain.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {flightResult.causeChain.map((node, idx) => {
                const isRoot = idx === 0;
                const isTarget = idx === flightResult.causeChain.length - 1;
                const isAirport = node.length === 3 && node === node.toUpperCase();

                return (
                  <React.Fragment key={`${node}-${idx}`}>
                    <span
                      onClick={() => {
                        if (!isAirport && onSelectRelatedFlight) {
                          onSelectRelatedFlight(node);
                        }
                      }}
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-mono font-bold ${
                        isRoot
                          ? "bg-rose-100 text-rose-900 ring-1 ring-rose-400"
                          : isTarget
                          ? "bg-sky-100 text-sky-900 ring-1 ring-sky-400 font-bold"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer"
                      }`}
                    >
                      {isAirport ? `Weather closure at ${node}` : node}
                    </span>
                    {idx < flightResult.causeChain.length - 1 && (
                      <span className="text-slate-400 font-bold" aria-hidden="true">
                        →
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {flightResult.rootAirport
                ? `Disruption cascaded through rotation legs on ${flightResult.tail} originating from closure at ${flightResult.rootAirport}.`
                : "No upstream airport closure disruption recorded on this leg."}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-emerald-700 font-medium">
            Flight operated without downstream disruption.
          </p>
        )}
      </div>

      {/* Passenger Connections at Risk */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Passenger Connections ({outboundConnections.length + inboundConnections.length})
        </h3>
        {outboundConnections.length === 0 && inboundConnections.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No scheduled connecting passenger itineraries on this leg.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {outboundConnections.map((c) => (
              <div
                key={c.connectionId}
                className={`flex items-center justify-between rounded-lg border p-2 text-xs ${
                  c.status === "missed"
                    ? "border-rose-200 bg-rose-50/60 text-rose-900"
                    : c.status === "cancelled"
                    ? "border-purple-200 bg-purple-50/60 text-purple-900"
                    : "border-slate-200 bg-slate-50/50 text-slate-800"
                }`}
              >
                <div>
                  <span className="font-mono font-bold">{c.connectionId}:</span> Transfer to{" "}
                  <button
                    type="button"
                    onClick={() => onSelectRelatedFlight && onSelectRelatedFlight(c.toFlight)}
                    className="font-mono font-semibold underline text-sky-700 hover:text-sky-900"
                  >
                    {c.toFlight}
                  </button>{" "}
                  at {c.airport} ({c.passengers} pax)
                </div>
                <div className="font-semibold">
                  {c.status === "missed" ? (
                    <span className="text-rose-700 font-bold">MISSED CONNECTION</span>
                  ) : c.status === "cancelled" ? (
                    <span className="text-purple-700 font-bold">CANCELLED</span>
                  ) : (
                    <span className="text-emerald-700">Made ({c.connectionWindowMinutes}m window)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crew Duty Status */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Assigned Crew Rotation
        </h3>
        {crew ? (
          <div
            className={`mt-2 rounded-lg border p-2.5 text-xs ${
              crew.isViolation
                ? "border-rose-200 bg-rose-50/70 text-rose-900"
                : "border-slate-200 bg-slate-50/60 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <span className="font-mono">Crew {crew.crewId} (Base: {crew.base})</span>
              <span>
                {crew.isViolation ? (
                  <span className="text-rose-700 font-bold">
                    VIOLATION: +{crew.overByMinutes}m OVER LIMIT
                  </span>
                ) : (
                  <span className="text-emerald-700">
                    Within Limit ({crew.dutyMinutes} / {crew.maxDutyMinutes}m)
                  </span>
                )}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Duty started at {formatMinutesToTime(crew.dutyStart)} IST • Max legal limit: 600 min
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No crew roster information available.</p>
        )}
      </div>
    </div>
  );
}
