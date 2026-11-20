"use client";

import React, { useMemo } from "react";
import type { Airport, FlightResult, Flight, Closure } from "@/engine/types";

interface AirMapProps {
  airports: Airport[];
  flightResults: Record<string, FlightResult>;
  rawFlights: Flight[];
  closure?: Closure;
  selectedFlightId?: string;
  selectedAirportId?: string;
  onSelectFlight: (flightId: string) => void;
  onSelectAirport: (airportId: string) => void;
}

export function AirMap({
  airports,
  flightResults,
  rawFlights,
  closure,
  selectedFlightId,
  selectedAirportId,
  onSelectFlight,
  onSelectAirport,
}: AirMapProps) {
  // India geographic bounding box for SVG projection
  const minLat = 8.0;
  const maxLat = 32.5;
  const minLng = 70.0;
  const maxLng = 93.0;

  const svgWidth = 600;
  const svgHeight = 650;
  const padding = 45;

  const project = (lat: number, lng: number): { x: number; y: number } => {
    const xRatio = (lng - minLng) / (maxLng - minLng);
    const yRatio = (lat - minLat) / (maxLat - minLat);
    const x = padding + xRatio * (svgWidth - 2 * padding);
    const y = svgHeight - padding - yRatio * (svgHeight - 2 * padding);
    return { x, y };
  };

  const airportCoords = useMemo(() => {
    const map = new Map<string, { x: number; y: number; airport: Airport }>();
    for (const ap of airports) {
      map.set(ap.id, { ...project(ap.lat, ap.lng), airport: ap });
    }
    return map;
  }, [airports]);

  // Aggregate flight routes to draw unique arcs
  const routeEdges = useMemo(() => {
    return rawFlights.map((f) => {
      const from = airportCoords.get(f.origin);
      const to = airportCoords.get(f.destination);
      const sim = flightResults[f.flight_id];

      return {
        flight: f,
        sim,
        from,
        to,
        isSelected: f.flight_id === selectedFlightId,
      };
    });
  }, [rawFlights, flightResults, airportCoords, selectedFlightId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Network Topology &amp; Disruption Flow
          </h2>
          <p className="text-xs text-slate-500">
            Geographic projection of 16 airports and 70 flight routes with delay band styling
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1">
            <span className="h-2 w-4 bg-emerald-500 rounded-xs" />
            <span>On Time</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-4 bg-amber-500 rounded-xs" />
            <span>1–60m Late</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-4 bg-rose-500 rounded-xs" />
            <span>61m+ Late</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-rose-600 bg-rose-100" />
            <span>Closed Hub</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full max-w-[620px] select-none"
          role="img"
          aria-label="Interactive map of India showing airport hubs and active flight delay paths"
        >
          {/* Subtle background grid */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path
              d="M 30 0 L 0 0 0 30"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Flight Routes (Edges) */}
          <g id="flight-edges">
            {routeEdges.map(({ flight, sim, from, to, isSelected }) => {
              if (!from || !to) return null;

              const isCancelled = sim?.status === "cancelled";
              const isHeavyDelay = (sim?.arrDelay ?? 0) > 60;
              const isMinorDelay = (sim?.arrDelay ?? 0) > 0 && !isHeavyDelay;

              let strokeColor = "#10b981"; // emerald on-time
              let strokeDash = "none";
              let strokeWidth = 1.2;
              let opacity = 0.45;

              if (isCancelled) {
                strokeColor = "#a855f7"; // purple
                strokeDash = "3,3";
                strokeWidth = 2;
                opacity = 0.8;
              } else if (isHeavyDelay) {
                strokeColor = "#e11d48"; // rose
                strokeDash = "6,4";
                strokeWidth = 2.5;
                opacity = 0.85;
              } else if (isMinorDelay) {
                strokeColor = "#f59e0b"; // amber
                strokeDash = "4,4";
                strokeWidth = 1.8;
                opacity = 0.7;
              }

              if (isSelected) {
                strokeColor = "#0284c7";
                strokeWidth = 4;
                strokeDash = "none";
                opacity = 1;
              }

              // Quadratic curve path
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2 - 20;

              return (
                <path
                  key={flight.flight_id}
                  d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                  opacity={opacity}
                  tabIndex={0}
                  role="button"
                  onClick={() => onSelectFlight(flight.flight_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectFlight(flight.flight_id);
                    }
                  }}
                  aria-label={`Flight ${flight.flight_id} from ${flight.origin} to ${flight.destination}, ${
                    sim?.status ?? "on time"
                  }`}
                  className="cursor-pointer transition-all hover:opacity-100 hover:stroke-width-[3] focus-visible:outline-none focus-visible:stroke-sky-600 focus-visible:stroke-[4]"
                />
              );
            })}
          </g>

          {/* Airport Nodes */}
          <g id="airport-nodes">
            {Array.from(airportCoords.values()).map(({ x, y, airport }) => {
              const isClosed = closure?.airport === airport.id;
              const isSelected = selectedAirportId === airport.id;
              const isHub = airport.tier === "mega_hub";

              return (
                <g
                  key={airport.id}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => onSelectAirport(airport.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectAirport(airport.id);
                    }
                  }}
                  aria-label={`Airport ${airport.name} (${airport.id}), ${airport.city}. ${
                    isClosed ? "CLOSED FOR DISRUPTION" : "Open"
                  }`}
                  className="cursor-pointer focus-visible:outline-none group"
                >
                  {/* Closed Pulse Ring */}
                  {isClosed && (
                    <circle
                      r="16"
                      className="animate-ping fill-rose-400 opacity-60"
                    />
                  )}

                  {/* Halo on selection */}
                  {isSelected && (
                    <circle
                      r="14"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={isHub ? 6.5 : 4.5}
                    className={`transition-transform duration-150 group-hover:scale-125 ${
                      isClosed
                        ? "fill-rose-600 stroke-2 stroke-white shadow-md"
                        : isHub
                        ? "fill-slate-900 stroke-2 stroke-white"
                        : "fill-slate-600 stroke-1 stroke-white"
                    }`}
                  />

                  {/* Airport Code Label */}
                  <text
                    x={8}
                    y={3.5}
                    className={`text-[11px] font-mono font-bold select-none ${
                      isClosed
                        ? "fill-rose-700 font-extrabold"
                        : "fill-slate-800 group-hover:fill-sky-700"
                    }`}
                  >
                    {airport.id}
                  </text>

                  {/* City subtitle for hubs */}
                  {isHub && (
                    <text
                      x={8}
                      y={13}
                      className="text-[9px] fill-slate-500 font-medium select-none"
                    >
                      {airport.city}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
