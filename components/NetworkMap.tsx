"use client";

import React, { useMemo, useState, useEffect } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import indiaGeoRaw from "@/data/india.geo.json";
import { formatMinutesToTime } from "@/engine/time";
import { Play, Pause, RotateCcw, Eye, Layers, Globe } from "lucide-react";

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
  simTime?: number;
  onSimTimeChange?: (time: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  playSpeed?: number;
  onPlaySpeedChange?: (speed: number) => void;
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
  simTime,
  onSimTimeChange,
  isPlaying,
  onTogglePlay,
  playSpeed,
  onPlaySpeedChange,
}: NetworkMapProps) {
  const [internalHover, setInternalHover] = useState<string | null>(null);
  const activeHover = hoveredFlightId ?? internalHover;

  // Live Simulation Playback State (Controlled or Uncontrolled)
  const [internalSimTime, setInternalSimTime] = useState<number>(540); // 09:00 IST default mid-closure
  const [internalIsPlaying, setInternalIsPlaying] = useState<boolean>(false);
  const [internalPlaySpeed, setInternalPlaySpeed] = useState<number>(5); // 5x speed
  const [viewMode, setViewMode] = useState<"all" | "active">("all");
  const [mapLayer, setMapLayer] = useState<"satellite" | "tactical">("satellite");

  const effectiveSimTime = simTime !== undefined ? simTime : internalSimTime;
  const effectiveIsPlaying = isPlaying !== undefined ? isPlaying : internalIsPlaying;
  const effectivePlaySpeed = playSpeed !== undefined ? playSpeed : internalPlaySpeed;

  const handleSimTimeChange = (time: number) => {
    if (onSimTimeChange) onSimTimeChange(time);
    else setInternalSimTime(time);
  };

  const handleTogglePlay = () => {
    if (onTogglePlay) onTogglePlay();
    else setInternalIsPlaying((p) => !p);
  };

  const handlePlaySpeedChange = (speed: number) => {
    if (onPlaySpeedChange) onPlaySpeedChange(speed);
    else setInternalPlaySpeed(speed);
  };

  const svgWidth = 600;
  const svgHeight = 620;

  // Internal playback loop when not parent-controlled
  useEffect(() => {
    if (isPlaying !== undefined) return;
    if (!internalIsPlaying) return;
    const interval = setInterval(() => {
      setInternalSimTime((prev) => {
        if (prev >= 1430) {
          setInternalIsPlaying(false);
          return 300; // loop back to 05:00
        }
        return prev + 1;
      });
    }, 1000 / internalPlaySpeed);

    return () => clearInterval(interval);
  }, [isPlaying, internalIsPlaying, internalPlaySpeed]);

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

  // Dynamic Web Mercator satellite tile calculation matching exact D3 projection
  const satelliteTiles = useMemo(() => {
    const z = 5;
    const n = Math.pow(2, z);
    const tiles: { key: string; url: string; x: number; y: number; width: number; height: number }[] = [];

    for (let x = 21; x <= 25; x++) {
      for (let y = 11; y <= 16; y++) {
        const lonMin = (x / n) * 360 - 180;
        const lonMax = ((x + 1) / n) * 360 - 180;
        const latMin = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180) / Math.PI;
        const latMax = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180) / Math.PI;

        const p0 = projection([lonMin, latMax]);
        const p1 = projection([lonMax, latMin]);

        if (p0 && p1) {
          const xPos = p0[0];
          const yPos = p0[1];
          const w = p1[0] - p0[0];
          const h = p1[1] - p0[1];

          if (xPos + w >= 0 && xPos <= svgWidth && yPos + h >= 0 && yPos <= svgHeight) {
            tiles.push({
              key: `${z}-${x}-${y}`,
              url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
              x: xPos,
              y: yPos,
              width: w,
              height: h,
            });
          }
        }
      }
    }
    return tiles;
  }, [projection, svgWidth, svgHeight]);

  const isWithinClosure = effectiveSimTime >= closureStart && effectiveSimTime <= closureEnd;

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

      // Live Airborne calculation at effectiveSimTime
      const dep = f.depMin ?? 480;
      const arr = f.arrMin ?? 600;
      const isAirborne = f.band !== "cancelled" && effectiveSimTime >= dep && effectiveSimTime <= arr;

      // Current position along quadratic bezier at progress t in [0, 1]
      let currentX = 0;
      let currentY = 0;
      let angleDeg = 0;

      if (isAirborne && arr > dep) {
        const t = Math.max(0, Math.min(1, (effectiveSimTime - dep) / (arr - dep)));
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
  }, [flights, airportPoints, selectedFlightId, activeHover, effectiveSimTime]);

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
      {/* TACTICAL MAP CONTAINER */}
      <div className="relative overflow-hidden rounded-card border border-slate-800 bg-[#070D18] shadow-card">
        {/* Top Floating Telemetry Overlay Bar */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          {/* Live Zulu/IST Clock & Airborne Badge */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 rounded bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 text-xs shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono font-medium text-white tracking-normal">
                {formatMinutesToTime(effectiveSimTime)} IST
              </span>
              <span className="text-[10px] text-slate-400">Live tracking</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded bg-slate-900/90 border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              <span className="font-mono font-semibold text-white">{activeAirborneCount}</span>
              <span>Airborne</span>
            </div>
          </div>

          {/* Closure Status Banner or View Mode Toggle */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {closedAirport && (
              <div
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium border ${
                  isWithinClosure
                    ? "bg-rose-950/90 border-rose-700 text-rose-200"
                    : "bg-slate-900/90 border-slate-700 text-slate-300"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>
                  {closedAirport} {isWithinClosure ? "ground stop active" : "scheduled stop"} ({closureLabel})
                </span>
              </div>
            )}

            {/* Satellite / Tactical Map Layer Toggle */}
            <button
              type="button"
              onClick={() => setMapLayer(mapLayer === "satellite" ? "tactical" : "satellite")}
              className="flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Toggle satellite imagery vs tactical map"
            >
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              <span>{mapLayer === "satellite" ? "Satellite" : "Tactical"}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === "all" ? "active" : "all")}
              className="flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Toggle all corridors vs active airborne flights"
            >
              {viewMode === "all" ? <Layers className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{viewMode === "all" ? "All routes" : "Airborne only"}</span>
            </button>
          </div>
        </div>

        {/* Tactical SVG Display */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Tactical map of Indian airspace showing flight routes and weather closures"
        >
          <defs>
            {/* Satellite Grid pattern */}
            <pattern id="radar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#162238" strokeWidth="0.6" strokeDasharray="1,3" />
            </pattern>

            {/* Ocean Vignette */}
            <radialGradient id="ocean-vignette" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#0B1528" />
              <stop offset="100%" stopColor="#050912" />
            </radialGradient>
          </defs>

          {/* Deep Ocean / Space Background */}
          <rect width="100%" height="100%" fill={mapLayer === "satellite" ? "#040814" : "url(#ocean-vignette)"} />
          {mapLayer === "tactical" && <rect width="100%" height="100%" fill="url(#radar-grid)" opacity="0.6" />}

          {/* ESRI World Satellite Imagery Tiles */}
          {mapLayer === "satellite" && (
            <g id="satellite-tiles">
              {satelliteTiles.map((tile) => (
                <image
                  key={tile.key}
                  href={tile.url}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  preserveAspectRatio="none"
                />
              ))}
              {/* Semi-transparent dark veil to preserve crisp contrast for corridors and labels */}
              <rect width="100%" height="100%" fill="#050B17" opacity="0.36" />
            </g>
          )}

          {/* Concentric Distance Rings around Closed Airport */}
          {closedAirportCoords && (
            <g id="radar-range-rings" opacity={mapLayer === "satellite" ? "0.4" : "0.25"}>
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="50" fill="none" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="3,3" />
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="110" fill="none" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="3,3" />
              <circle cx={closedAirportCoords.x} cy={closedAirportCoords.y} r="180" fill="none" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="4,4" />
            </g>
          )}

          {/* India Landmass Boundary Hairline */}
          <g id="satellite-landmass">
            {indiaGeo.features.map((feature: Feature<Geometry>, i: number) => (
              <path
                key={`sat-geo-${i}`}
                d={pathGenerator(feature) || ""}
                fill={mapLayer === "satellite" ? "none" : "#0F1B2F"}
                stroke={mapLayer === "satellite" ? "rgba(226, 232, 240, 0.45)" : "#1E3A5F"}
                strokeWidth={mapLayer === "satellite" ? "1.2" : "1"}
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* Flight Route Corridors (Curved Arcs) */}
          <g id="flight-corridors">
            {sortedEdges.map(
              ({ flight, pathData, strokeWidth, isSelected, isHovered, isAirborne }) => {
                if (viewMode === "active" && !isAirborne && !isSelected && !isHovered) {
                  return null;
                }

                let strokeColor = "#15803D"; // on-time
                let opacity = isAirborne ? 0.75 : 0.25;
                let dashArray: string | undefined = undefined;

                if (flight.band === "cancelled") {
                  strokeColor = "#64748B";
                  dashArray = "3,3";
                  opacity = 0.4;
                } else if (flight.band === "severe") {
                  strokeColor = "#DC2626";
                  opacity = isAirborne ? 0.95 : 0.55;
                } else if (flight.band === "minor") {
                  strokeColor = "#D97706";
                  opacity = isAirborne ? 0.85 : 0.45;
                } else if (flight.band === "spare") {
                  strokeColor = "#0E7490";
                  opacity = isAirborne ? 0.9 : 0.5;
                }

                if (isHovered || isSelected) {
                  strokeColor = "#2563EB";
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
                    className="cursor-pointer transition-colors duration-150"
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

              let blipColor = "#15803D";
              if (e.flight.band === "severe") blipColor = "#DC2626";
              else if (e.flight.band === "minor") blipColor = "#D97706";
              else if (e.flight.band === "spare") blipColor = "#0E7490";

              return (
                <g
                  key={`plane-${e.flight.id}`}
                  transform={`translate(${e.currentX}, ${e.currentY})`}
                  className="cursor-pointer select-none"
                  onClick={() => onSelectFlight(e.flight.id)}
                  onMouseEnter={() => handleHover(e.flight.id)}
                  onMouseLeave={() => handleHover(null)}
                >
                  {/* Subtle Blip Ring */}
                  <circle r={isSel || isHov ? 6 : 4} fill={blipColor} opacity="0.25" />

                  {/* Rotated Aircraft Marker */}
                  <g transform={`rotate(${e.angleDeg})`}>
                    <path
                      d="M 0 -6 L 4 4 L 0 2 L -4 4 Z"
                      fill={isSel || isHov ? "#2563EB" : blipColor}
                      stroke="#FFFFFF"
                      strokeWidth="0.8"
                    />
                  </g>

                  {/* Flight Callout Label */}
                  <g transform="translate(6, -6)">
                    <rect x="0" y="0" width="46" height="13" rx="2" fill="#091220" stroke={blipColor} strokeWidth="0.6" opacity="0.95" />
                    <text x="3" y="9.5" fill="#FFFFFF" fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="medium">
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
                      r="14"
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      opacity="0.8"
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
                    fill={isClosed ? "#DC2626" : isMega ? "#38BDF8" : "#94A3B8"}
                    stroke="#070D18"
                    strokeWidth="1.5"
                  />

                  {/* IATA Airport Label with Dark Badge */}
                  <g transform={`translate(${pt.x + offset.dx}, ${pt.y + offset.dy})`}>
                    <text
                      textAnchor={offset.anchor || "start"}
                      fill={isClosed ? "#FCA5A5" : "#F8FAFC"}
                      fontSize={isMega ? "10" : "9"}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="medium"
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
              onClick={handleTogglePlay}
              aria-label={effectiveIsPlaying ? "Pause simulation playback" : "Play live simulation"}
              className={`flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold transition-all shadow-subtle ${
                effectiveIsPlaying
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "bg-skyaccent hover:bg-blue-600 text-white"
              }`}
            >
              {effectiveIsPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{effectiveIsPlaying ? "Pause" : "Play Live"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (effectiveIsPlaying) handleTogglePlay();
                handleSimTimeChange(300); // 05:00
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
                  onClick={() => handlePlaySpeedChange(speed)}
                  className={`rounded px-1.5 py-0.5 font-medium transition-colors ${
                    effectivePlaySpeed === speed ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Time Scrubber Slider */}
          <div className="flex items-center gap-3 w-full sm:w-72">
            <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0">
              05:00
            </span>
            <input
              type="range"
              min={300}
              max={1440}
              step={5}
              value={effectiveSimTime}
              onChange={(e) => {
                handleSimTimeChange(parseInt(e.target.value, 10));
              }}
              aria-label="Simulation timeline scrubber"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-skyaccent"
            />
            <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0">
              24:00
            </span>
          </div>

          {/* Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-slate-400">Time:</span>
            <span className="font-medium text-slate-200">{formatMinutesToTime(effectiveSimTime)} IST</span>
          </div>
        </div>
      </div>

      {/* QUICK PICK CARDS: TOP 5 DELAYED FLIGHTS */}
      <div className="flex flex-col gap-1.5 rounded-card border border-slate-200 bg-white p-3 shadow-subtle">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
          <span>Top delayed corridors</span>
          <span className="text-[11px] font-mono text-slate-400">Impact ranking</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {topDelayed.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFlight(f.id)}
              className={`flex flex-col rounded border p-2 text-left text-xs transition-colors ${
                f.id === selectedFlightId
                  ? "border-slate-800 bg-slate-50 font-medium text-slate-900 shadow-xs ring-1 ring-slate-800/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div className="flex items-center justify-between font-mono">
                <span className="font-medium">{f.id}</span>
                <span className="text-[11px] font-medium text-rose-600">+{f.delayMin}m</span>
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
