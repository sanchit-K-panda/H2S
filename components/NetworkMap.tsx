"use client";

import React, { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import indiaGeoRaw from "@/data/india.geo.json";
import { Badge } from "./ui/badge";

const indiaGeo = indiaGeoRaw as unknown as FeatureCollection<Geometry>;

export type MapFlight = {
  id: string;
  origin: string;
  destination: string;
  pax: number;
  band: "ok" | "minor" | "severe" | "cancelled" | "spare";
  delayMin: number;
  label: string;
};

export type NetworkMapProps = {
  airports: {
    id: string;
    city: string;
    lat: number;
    lng: number;
    tier: "mega_hub" | "regional_hub" | "spoke";
  }[];
  flights: MapFlight[];
  closedAirport: string | null;
  closureLabel?: string;
  selectedFlightId: string | null;
  hoveredFlightId?: string | null;
  onSelectFlight: (id: string) => void;
  onHoverFlight?: (id: string | null) => void;
};

// Offset positioning for crowded IATA airport labels
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor?: "start" | "end" | "middle" }> = {
  BOM: { dx: -10, dy: 14, anchor: "end" },
  PNQ: { dx: 12, dy: 10, anchor: "start" },
  GOI: { dx: -10, dy: 12, anchor: "end" },
  DEL: { dx: 0, dy: -12, anchor: "middle" },
  JAI: { dx: -12, dy: 2, anchor: "end" },
  LKO: { dx: 12, dy: 2, anchor: "start" },
  BLR: { dx: 14, dy: -2, anchor: "start" },
  MAA: { dx: 14, dy: 6, anchor: "start" },
  COK: { dx: -12, dy: 8, anchor: "end" },
  TRV: { dx: 12, dy: 10, anchor: "start" },
  HYD: { dx: 12, dy: 0, anchor: "start" },
  CCU: { dx: 12, dy: 4, anchor: "start" },
  GAU: { dx: 12, dy: -4, anchor: "start" },
  IXC: { dx: 10, dy: -8, anchor: "start" },
  AMD: { dx: -12, dy: -4, anchor: "end" },
  BBI: { dx: 12, dy: 8, anchor: "start" },
};

export function NetworkMap({
  airports,
  flights,
  closedAirport,
  closureLabel,
  selectedFlightId,
  hoveredFlightId,
  onSelectFlight,
  onHoverFlight,
}: NetworkMapProps) {
  const [internalHover, setInternalHover] = useState<string | null>(null);
  const activeHover = hoveredFlightId ?? internalHover;

  const svgWidth = 600;
  const svgHeight = 620;

  // D3 Mercator Projection fit to India boundary GeoJSON
  const projection = useMemo(() => {
    const proj = geoMercator();
    proj.fitExtent(
      [
        [20, 20],
        [svgWidth - 20, svgHeight - 20],
      ],
      indiaGeo
    );
    return proj;
  }, []);

  const pathGenerator = useMemo(() => {
    return geoPath().projection(projection);
  }, [projection]);

  // Projected airport coordinates
  const airportPoints = useMemo(() => {
    const map = new Map<
      string,
      { x: number; y: number; airport: (typeof airports)[0] }
    >();
    for (const ap of airports) {
      const coords = projection([ap.lng, ap.lat]);
      if (coords) {
        map.set(ap.id, { x: coords[0], y: coords[1], airport: ap });
      }
    }
    return map;
  }, [airports, projection]);

  // Process flight routes into curved arcs
  const flightEdges = useMemo(() => {
    return flights.map((f) => {
      const from = airportPoints.get(f.origin);
      const to = airportPoints.get(f.destination);
      if (!from || !to) return null;

      // Quadratic curve offset perpendicular by 10%
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const perpX = -dy / (dist || 1);
      const perpY = dx / (dist || 1);

      // Deterministic offset based on direction to prevent overlap
      const offsetSign = f.origin < f.destination ? 1 : -1;
      const curveDist = Math.min(28, dist * 0.12) * offsetSign;
      const cx = midX + perpX * curveDist;
      const cy = midY + perpY * curveDist;

      const pathData = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;

      const strokeWidth = Math.max(1.2, Math.min(3.5, (f.pax / 180) * 3.5));

      return {
        flight: f,
        from,
        to,
        pathData,
        strokeWidth,
        isSelected: f.id === selectedFlightId,
        isHovered: f.id === activeHover,
      };
    });
  }, [flights, airportPoints, selectedFlightId, activeHover]);

  // Sort edges so on-time (ok) flights render underneath and late/severe render on top
  const sortedEdges = useMemo(() => {
    return [...flightEdges.filter((e): e is NonNullable<typeof e> => e !== null)].sort(
      (a, b) => {
        const order = { ok: 1, minor: 2, spare: 3, severe: 4, cancelled: 5 };
        const rankA = a.isSelected ? 10 : a.isHovered ? 9 : order[a.flight.band] || 1;
        const rankB = b.isSelected ? 10 : b.isHovered ? 9 : order[b.flight.band] || 1;
        return rankA - rankB;
      }
    );
  }, [flightEdges]);

  // Top 5 delayed flights for quick pick
  const topDelayed = useMemo(() => {
    return [...flights]
      .filter((f) => f.delayMin > 0 && f.band !== "cancelled")
      .sort((a, b) => b.delayMin - a.delayMin)
      .slice(0, 5);
  }, [flights]);

  const handleHover = (id: string | null) => {
    setInternalHover(id);
    if (onHoverFlight) onHoverFlight(id);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* SVG Canvas Container */}
      <div className="relative overflow-hidden rounded-card border border-skyborder bg-[#F3F7FB] shadow-subtle">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Interactive flight disruption map of India showing airport hubs and active flight delay paths"
        >
          {/* Subtle background graticule lines */}
          <defs>
            <pattern
              id="map-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="0.6"
                strokeDasharray="2,2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />

          {/* India Boundary Fill & Stroke */}
          <g id="country-base">
            {indiaGeo.features.map((feature: Feature<Geometry>, i: number) => (
              <path
                key={`geo-${i}`}
                d={pathGenerator(feature) || ""}
                fill="#EAF0F8"
                stroke="#C5D0E0"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* Flight Routes (Curved Arcs) */}
          <g id="flight-arcs">
            {sortedEdges.map(
              ({ flight, pathData, strokeWidth, isSelected, isHovered }) => {
                let strokeColor = "#0E9F6E"; // ontime green
                let opacity = 0.35;
                let dashArray: string | undefined = undefined;

                if (flight.band === "cancelled") {
                  strokeColor = "#64748B";
                  dashArray = "4,4";
                  opacity = 0.75;
                } else if (flight.band === "severe") {
                  strokeColor = "#DC2626";
                  opacity = 0.85;
                } else if (flight.band === "minor") {
                  strokeColor = "#B45309";
                  opacity = 0.7;
                } else if (flight.band === "spare") {
                  strokeColor = "#7C3AED";
                  opacity = 0.9;
                }

                if (isHovered || isSelected) {
                  strokeColor = "#2563EB";
                  opacity = 1;
                }

                return (
                  <path
                    key={flight.id}
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 4 : isHovered ? 3.2 : strokeWidth}
                    strokeDasharray={dashArray}
                    opacity={opacity}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelectFlight(flight.id)}
                    onMouseEnter={() => handleHover(flight.id)}
                    onMouseLeave={() => handleHover(null)}
                    onFocus={() => handleHover(flight.id)}
                    onBlur={() => handleHover(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectFlight(flight.id);
                      }
                    }}
                    aria-label={`${flight.id} ${flight.origin} to ${flight.destination}, ${flight.label}`}
                    className="cursor-pointer transition-all hover:opacity-100 focus-visible:outline-none"
                  />
                );
              }
            )}
          </g>

          {/* Airport Hub Nodes */}
          <g id="airports">
            {Array.from(airportPoints.values()).map(({ x, y, airport }) => {
              const isClosed = closedAirport === airport.id;
              const radius =
                airport.tier === "mega_hub" ? 8 : airport.tier === "regional_hub" ? 6 : 4.5;
              const offset = LABEL_OFFSETS[airport.id] || { dx: 10, dy: 4, anchor: "start" };

              return (
                <g
                  key={airport.id}
                  transform={`translate(${x}, ${y})`}
                  className="group cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`${airport.city} (${airport.id}), ${isClosed ? "CLOSED" : "Open"}`}
                >
                  {/* Closed Airport Soft Pulsing Ring */}
                  {isClosed && (
                    <>
                      <circle
                        r={radius + 8}
                        className="animate-ping fill-status-severe/30"
                      />
                      <circle
                        r={radius + 5}
                        fill="none"
                        stroke="#DC2626"
                        strokeWidth="2"
                        strokeDasharray="3,2"
                      />
                    </>
                  )}

                  {/* Airport Node Circle */}
                  <circle
                    r={radius}
                    fill={isClosed ? "#DC2626" : "#0B1B3A"}
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                    className="shadow-subtle transition-transform duration-150 group-hover:scale-125"
                  />

                  {/* IATA Label with White Halo (paint-order: stroke) */}
                  <text
                    x={offset.dx}
                    y={offset.dy}
                    textAnchor={offset.anchor || "start"}
                    className={`text-[11px] font-sans font-bold tracking-tight ${
                      isClosed ? "fill-status-severe" : "fill-navy"
                    }`}
                    style={{
                      paintOrder: "stroke",
                      stroke: "#FFFFFF",
                      strokeWidth: "3px",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }}
                  >
                    {airport.id}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Closed Airport Banner Tooltip */}
        {closedAirport && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-control border border-status-severe/30 bg-white/95 px-3 py-1.5 shadow-subtle backdrop-blur-xs">
            <span className="h-2 w-2 rounded-full bg-status-severe animate-pulse" />
            <span className="text-xs font-bold text-status-severe">
              {closedAirport} Closed {closureLabel ? `(${closureLabel})` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Legend & Quick Pick Bottom Bar */}
      <div className="flex flex-col gap-3 rounded-card border border-skyborder bg-white p-3.5 shadow-subtle sm:flex-row sm:items-center sm:justify-between text-xs">
        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-3 font-medium text-skymuted">
          <span className="text-[11px] font-bold uppercase tracking-wider text-skytext">
            Routes:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-status-ontime" />
            <span>On-time</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-status-minor" />
            <span>1–60m Delay</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-status-severe" />
            <span>61m+ Delay</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-status-cancelled border border-dashed border-slate-400" />
            <span>Cancelled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-status-spare" />
            <span>Spare Aircraft</span>
          </div>
        </div>

        {/* Quick Pick: Top 5 Delayed */}
        {topDelayed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-skyborder pt-2 sm:border-t-0 sm:pt-0">
            <span className="text-[11px] font-bold text-skymuted">Top Delays:</span>
            {topDelayed.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectFlight(f.id)}
                className={`rounded-[6px] border px-2 py-0.5 font-mono text-[11px] font-bold transition-colors ${
                  f.id === selectedFlightId
                    ? "border-skyaccent bg-blue-50 text-skyaccent"
                    : "border-skyborder bg-slate-50 text-skytext hover:bg-slate-100"
                }`}
              >
                {f.id} (+{f.delayMin}m)
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
