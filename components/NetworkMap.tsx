"use client";

import React, { useMemo, useState, useEffect } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import indiaGeoRaw from "@/data/india.geo.json";
import { formatMinutesToTime } from "@/engine/time";
import { Play, Pause, RotateCcw, Eye, Layers } from "lucide-react";

const indiaGeo = indiaGeoRaw as unknown as FeatureCollection<Geometry>;

export type MapFlight = {
  id: string;
  origin: string;
  destination: string;
  pax: number;
  band: "ok" | "minor" | "severe" | "cancelled" | "spare";
  delayMin: number;
  label: string;
  depMin?: number;
  arrMin?: number;
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
  closureStart?: number;
  closureEnd?: number;
  selectedFlightId: string | null;
  hoveredFlightId?: string | null;
  onSelectFlight: (id: string) => void;
  onHoverFlight?: (id: string | null) => void;
};

// Offset positioning for IATA airport labels
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor?: "start" | "end" | "middle" }> = {
  BOM: { dx: -12, dy: 14, anchor: "end" },
  PNQ: { dx: 14, dy: 10, anchor: "start" },
  GOI: { dx: -12, dy: 12, anchor: "end" },
  DEL: { dx: 0, dy: -14, anchor: "middle" },
  JAI: { dx: -14, dy: 2, anchor: "end" },
  LKO: { dx: 14, dy: 2, anchor: "start" },
  BLR: { dx: 16, dy: -2, anchor: "start" },
  MAA: { dx: 16, dy: 6, anchor: "start" },
  COK: { dx: -14, dy: 8, anchor: "end" },
  TRV: { dx: 14, dy: 10, anchor: "start" },
  HYD: { dx: 14, dy: 0, anchor: "start" },
  CCU: { dx: 14, dy: 4, anchor: "start" },
  GAU: { dx: 14, dy: -4, anchor: "start" },
  IXC: { dx: 12, dy: -8, anchor: "start" },
  AMD: { dx: -14, dy: -4, anchor: "end" },
  BBI: { dx: 14, dy: 8, anchor: "start" },
};

export function NetworkMap({
  airports,
  flights,
  closedAirport,
  closureLabel,
  closureStart = 480, // default 08:00
  closureEnd = 600,   // default 10:00
  selectedFlightId,
  hoveredFlightId,
  onSelectFlight,
  onHoverFlight,
}: NetworkMapProps) {
  const [internalHover, setInternalHover] = useState<string | null>(null);
  const activeHover = hoveredFlightId ?? internalHover;

  // Live Simulation Playback State
  const [simTime, setSimTime] = useState<number>(540); // 09:00 IST default mid-closure
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(5); // 5x speed
  const [viewMode, setViewMode] = useState<"all" | "active">("all");

  const svgWidth = 600;
  const svgHeight = 620;

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimTime((prev) => {
        if (prev >= 1430) {
          setIsPlaying(false);
          return 300; // loop back to 05:00
        }
        return prev + 1;
      });
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  // D3 Mercator Projection fit to India GeoJSON
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

  // Closed airport coords for radar rings
  const closedAirportCoords = useMemo(() => {
    if (!closedAirport) return null;
    return airportPoints.get(closedAirport) || null;
  }, [closedAirport, airportPoints]);

  const isWithinClosure = simTime >= closureStart && simTime <= closureEnd;

  // Compute curved flight paths with bezier control points
  const flightEdges = useMemo(() => {
    return flights.map((f) => {
      const from = airportPoints.get(f.origin);
      const to = airportPoints.get(f.destination);
      if (!from || !to) return null;

      // Quadratic curve offset perpendicular by 12%
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const perpX = -dy / (dist || 1);
      const perpY = dx / (dist || 1);

      const offsetSign = f.origin < f.destination ? 1 : -1;
      const curveDist = Math.min(28, dist * 0.12) * offsetSign;
      const cx = midX + perpX * curveDist;
      const cy = midY + perpY * curveDist;

      const pathData = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
      const strokeWidth = Math.max(1.2, Math.min(3.2, (f.pax / 180) * 3.2));

      // Live Airborne calculation at simTime
      const dep = f.depMin ?? 480;
      const arr = f.arrMin ?? 600;
      const isAirborne = f.band !== "cancelled" && simTime >= dep && simTime <= arr;

      // Current position along quadratic bezier at progress t in [0, 1]
      let currentX = 0;
      let currentY = 0;
      let angleDeg = 0;

      if (isAirborne && arr > dep) {
        const t = Math.max(0, Math.min(1, (simTime - dep) / (arr - dep)));
        const oneMinusT = 1 - t;
        currentX = oneMinusT * oneMinusT * from.x + 2 * oneMinusT * t * cx + t * t * to.x;
        currentY = oneMinusT * oneMinusT * from.y + 2 * oneMinusT * t * cy + t * t * to.y;

        // Tangent derivative for aircraft heading
        const dX = 2 * oneMinusT * (cx - from.x) + 2 * t * (to.x - cx);
        const dY = 2 * oneMinusT * (cy - from.y) + 2 * t * (to.y - cy);
        angleDeg = (Math.atan2(dY, dX) * 180) / Math.PI;
      }

      return {
        flight: f,
        from,
        to,
        cx,
        cy,
        pathData,
        strokeWidth,
        isSelected: f.id === selectedFlightId,
        isHovered: f.id === activeHover,
        isAirborne,
        currentX,
        currentY,
        angleDeg,
      };
    });
  }, [flights, airportPoints, selectedFlightId, activeHover, simTime]);

  // Sort edges so late/severe/active render on top
  const sortedEdges = useMemo(() => {
    return [...flightEdges.filter((e): e is NonNullable<typeof e> => e !== null)].sort(
      (a, b) => {
        const order = { ok: 1, minor: 2, spare: 3, severe: 4, cancelled: 5 };
        const rankA = a.isSelected ? 10 : a.isHovered ? 9 : a.isAirborne ? 8 : order[a.flight.band] || 1;
        const rankB = b.isSelected ? 10 : b.isHovered ? 9 : b.isAirborne ? 8 : order[b.flight.band] || 1;
        return rankA - rankB;
      }
    );
  }, [flightEdges]);

  // Active airborne count at current simulation minute
  const activeAirborneCount = useMemo(() => {
    return flightEdges.filter((e) => e?.isAirborne).length;
  }, [flightEdges]);

  // Top delayed flights
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
    <div className="flex flex-col gap-3">
      {/* SATELLITE TACTICAL RADAR CANVAS CONTAINER */}
      <div className="relative overflow-hidden rounded-card border border-slate-800 bg-[#070D18] shadow-card">
        {/* Top Floating Telemetry Overlay Bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          {/* Live Zulu/IST Clock & Airborne Badge */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 rounded-chip bg-slate-900/90 border border-slate-700/80 px-3 py-1 text-xs backdrop-blur-md shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-white tracking-wider">
                {formatMinutesToTime(simTime)} IST
              </span>
              <span className="text-[10px] text-slate-400">RADAR ACTIVE</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-chip bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 backdrop-blur-md">
              <span className="font-mono font-bold">{activeAirborneCount}</span>
              <span>Airborne</span>
            </div>
          </div>

          {/* Closure Status Banner or View Mode Toggle */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {closedAirport && (
              <div
                className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[11px] font-bold border backdrop-blur-md ${
                  isWithinClosure
                    ? "bg-rose-950/90 border-rose-600 text-rose-200 animate-pulse"
                    : "bg-slate-900/90 border-slate-700 text-slate-300"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>
                  {closedAirport} {isWithinClosure ? "GROUND STOP ACTIVE" : "SCHEDULED STOP"} ({closureLabel})
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setViewMode(viewMode === "all" ? "active" : "all")}
              className="flex items-center gap-1 rounded-chip bg-slate-800/90 border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700"
              title="Toggle all corridors vs active airborne flights"
            >
              {viewMode === "all" ? <Layers className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span>{viewMode === "all" ? "All Routes" : "Airborne Only"}</span>
            </button>
          </div>
        </div>

        {/* Tactical SVG Display */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Tactical satellite radar map of Indian airspace showing live flight tracking and ground stops"
        >
          <defs>
            {/* Satellite Grid pattern */}
            <pattern id="radar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#162238" strokeWidth="0.6" strokeDasharray="1,3" />
            </pattern>

            {/* Neon Glow Filters */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Radar Sweep Gradient */}
            <radialGradient id="ocean-vignette" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#0B1528" />
              <stop offset="100%" stopColor="#050912" />
            </radialGradient>
          </defs>

          {/* Deep Satellite Ocean Background */}
          <rect width="100%" height="100%" fill="url(#ocean-vignette)" />
          <rect width="100%" height="100%" fill="url(#radar-grid)" opacity="0.7" />

          {/* Concentric Radar Distance Rings around Closed Airport (or center DEL) */}
          {closedAirportCoords && (
            <g id="radar-range-rings" opacity="0.3">
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="50" fill="none" stroke="#0284C7" strokeWidth="0.8" strokeDasharray="3,3" />
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="110" fill="none" stroke="#0284C7" strokeWidth="0.8" strokeDasharray="3,3" />
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="180" fill="none" stroke="#0284C7" strokeWidth="0.8" strokeDasharray="4,4" />
            </g>
          )}

          {/* India Satellite Landmass with Glowing Border */}
          <g id="satellite-landmass">
            {indiaGeo.features.map((feature: Feature<Geometry>, i: number) => (
              <path
                key={`sat-geo-${i}`}
                d={pathGenerator(feature) || ""}
                fill="#0F1B2F"
                stroke="#0284C7"
                strokeWidth="1.1"
                strokeOpacity="0.8"
                strokeLinejoin="round"
                filter="drop-shadow(0 0 6px rgba(2, 132, 199, 0.25))"
              />
            ))}
          </g>

          {/* Flight Route Corridors (Curved Arcs) */}
          <g id="flight-corridors">
            {sortedEdges.map(
              ({ flight, pathData, strokeWidth, isSelected, isHovered, isAirborne }) => {
                if (viewMode === "active" && !isAirborne && !isSelected && !isHovered) {
                  return null; // hide non-active in active-only mode
                }

                let strokeColor = "#10B981"; // emerald ontime
                let opacity = isAirborne ? 0.75 : 0.25;
                let dashArray: string | undefined = undefined;

                if (flight.band === "cancelled") {
                  strokeColor = "#64748B";
                  dashArray = "3,3";
                  opacity = 0.4;
                } else if (flight.band === "severe") {
                  strokeColor = "#EF4444";
                  opacity = isAirborne ? 0.95 : 0.55;
                } else if (flight.band === "minor") {
                  strokeColor = "#F59E0B";
                  opacity = isAirborne ? 0.85 : 0.45;
                } else if (flight.band === "spare") {
                  strokeColor = "#A855F7";
                  opacity = isAirborne ? 0.9 : 0.5;
                }

                if (isHovered || isSelected) {
                  strokeColor = "#38BDF8";
                  opacity = 1;
                }

                return (
                  <path
                    key={`corridor-${flight.id}`}
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 3.5 : isHovered ? 2.8 : strokeWidth}
                    strokeDasharray={dashArray}
                    opacity={opacity}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelectFlight(flight.id)}
                    onMouseEnter={() => handleHover(flight.id)}
                    onMouseLeave={() => handleHover(null)}
                    className="cursor-pointer transition-all duration-150 hover:stroke-cyan-300"
                  />
                );
              }
            )}
          </g>

          {/* LIVE AIRBORNE AIRCRAFT RADAR BLIPS */}
          <g id="airborne-aircraft-blips">
            {flightEdges.map((e) => {
              if (!e || !e.isAirborne) return null;
              const isSel = e.flight.id === selectedFlightId;
              const isHov = e.flight.id === activeHover;

              let blipColor = "#10B981";
              if (e.flight.band === "severe") blipColor = "#EF4444";
              else if (e.flight.band === "minor") blipColor = "#F59E0B";
              else if (e.flight.band === "spare") blipColor = "#A855F7";

              return (
                <g
                  key={`plane-${e.flight.id}`}
                  transform={`translate(${e.currentX}, ${e.currentY})`}
                  className="cursor-pointer select-none"
                  onClick={() => onSelectFlight(e.flight.id)}
                  onMouseEnter={() => handleHover(e.flight.id)}
                  onMouseLeave={() => handleHover(null)}
                >
                  {/* Radar Pulse Glow */}
                  <circle r={isSel || isHov ? 8 : 5} fill={blipColor} opacity="0.3" className="animate-ping" />

                  {/* Rotated Aircraft Marker */}
                  <g transform={`rotate(${e.angleDeg})`}>
                    <path
                      d="M 0 -6 L 4 4 L 0 2 L -4 4 Z"
                      fill={isSel || isHov ? "#38BDF8" : blipColor}
                      stroke="#FFFFFF"
                      strokeWidth="0.8"
                    />
                  </g>

                  {/* Flight Callout Label */}
                  <g transform="translate(6, -6)">
                    <rect x="0" y="0" width="46" height="13" rx="2.5" fill="#091220" stroke={blipColor} strokeWidth="0.6" opacity="0.9" />
                    <text x="3" y="9.5" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                      {e.flight.id}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* AIRPORT NODES & RADAR BEACONS */}
          <g id="airport-beacons">
            {airports.map((ap) => {
              const pt = airportPoints.get(ap.id);
              if (!pt) return null;

              const isClosed = ap.id === closedAirport;
              const isMega = ap.tier === "mega_hub";
              const isRegional = ap.tier === "regional_hub";
              const radius = isMega ? 6.5 : isRegional ? 5 : 3.5;
              const offset = LABEL_OFFSETS[ap.id] || { dx: 10, dy: 4, anchor: "start" };

              return (
                <g key={`ap-${ap.id}`} className="cursor-default select-none">
                  {/* Closed Airport Radar Shockwave */}
                  {isClosed && isWithinClosure && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="16"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="1.5"
                      opacity="0.8"
                      className="animate-ping"
                    />
                  )}

                  {/* Outer Radar Halo for Mega Hubs */}
                  {isMega && !isClosed && (
                    <circle cx={pt.x} cy={pt.y} r={radius + 3} fill="none" stroke="#38BDF8" strokeWidth="0.6" opacity="0.4" />
                  )}

                  {/* Beacon Core Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={radius}
                    fill={isClosed ? "#EF4444" : isMega ? "#38BDF8" : "#94A3B8"}
                    stroke="#070D18"
                    strokeWidth="1.5"
                    filter={isClosed ? "url(#glow-red)" : "url(#glow-cyan)"}
                  />

                  {/* IATA Airport Label with Dark Badge */}
                  <g transform={`translate(${pt.x + offset.dx}, ${pt.y + offset.dy})`}>
                    <text
                      textAnchor={offset.anchor || "start"}
                      fill={isClosed ? "#FCA5A5" : "#F8FAFC"}
                      fontSize={isMega ? "10" : "9"}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="bold"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
                    >
                      {ap.id}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* BOTTOM AVIATION PLAYBACK CONTROLLER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 bg-[#060B14] px-3.5 py-2.5 gap-2.5">
          {/* Controls: Play/Pause, Rewind, Speed */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? "Pause simulation playback" : "Play live simulation"}
              className={`flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-bold transition-all shadow-subtle ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "bg-skyaccent hover:bg-blue-600 text-white"
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? "Pause" : "Play Live"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setSimTime(300); // 05:00
              }}
              aria-label="Rewind to 05:00 IST start"
              className="rounded-control border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Reset to 05:00 IST"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Speed Selector */}
            <div className="flex items-center rounded-control border border-slate-700 bg-slate-900 p-0.5 text-[10px] font-mono">
              {[1, 5, 15].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaySpeed(speed)}
                  className={`rounded px-1.5 py-0.5 font-bold transition-colors ${
                    playSpeed === speed ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Time Scrubber Slider */}
          <div className="flex items-center gap-3 w-full sm:w-72">
            <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
              05:00
            </span>
            <input
              type="range"
              min={300}
              max={1440}
              step={5}
              value={simTime}
              onChange={(e) => {
                setIsPlaying(false);
                setSimTime(parseInt(e.target.value, 10));
              }}
              aria-label="Simulation timeline scrubber"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-skyaccent"
            />
            <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
              24:00
            </span>
          </div>

          {/* Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-slate-400">Time:</span>
            <span className="font-bold text-cyan-300">{formatMinutesToTime(simTime)} IST</span>
          </div>
        </div>
      </div>

      {/* QUICK PICK CARDS: TOP 5 DELAYED FLIGHTS */}
      <div className="flex flex-col gap-1.5 rounded-card border border-slate-200/90 bg-white p-3 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>Top Delayed Corridors (Click to inspect)</span>
          <span className="text-[11px] font-mono text-slate-400">Impact ranking</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {topDelayed.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFlight(f.id)}
              className={`flex flex-col rounded-control border p-2 text-left text-xs transition-all ${
                f.id === selectedFlightId
                  ? "border-skyaccent bg-blue-50 font-semibold text-navy shadow-xs ring-1 ring-skyaccent/30"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold">{f.id}</span>
                <span className="text-[11px] font-bold text-rose-600">+{f.delayMin}m</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                {f.origin} → {f.destination}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
