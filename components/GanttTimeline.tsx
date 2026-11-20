"use client";

import React, { useState, useMemo } from "react";
import type { FlightResult, Flight, Closure } from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { ArrowUpDown, Filter } from "lucide-react";

interface GanttTimelineProps {
  flightResults: Record<string, FlightResult>;
  baselineResults?: Record<string, FlightResult>;
  rawFlights: Flight[];
  closure?: Closure;
  selectedFlightId?: string;
  isRecoveryApplied?: boolean;
  onSelectFlight: (flightId: string) => void;
}

export function GanttTimeline({
  flightResults,
  baselineResults,
  rawFlights,
  closure,
  selectedFlightId,
  isRecoveryApplied = false,
  onSelectFlight,
}: GanttTimelineProps) {
  // Sort and filter states
  const [sortBy, setSortBy] = useState<"impact" | "tail">("impact");
  const [affectedOnly, setAffectedOnly] = useState(false);

  // Timeline time range: 05:00 (300 min) to 24:00 (1440 min) = 1140 min
  const minTime = 300;
  const maxTime = 1440;
  const totalDuration = maxTime - minTime;

  // Hourly grid markers from 05:00 to 24:00
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = minTime; m <= maxTime; m += 60) {
      list.push(m);
    }
    return list;
  }, [minTime, maxTime]);

  const getPercent = (timeMin: number) => {
    const clamped = Math.max(minTime, Math.min(maxTime, timeMin));
    return ((clamped - minTime) / totalDuration) * 100;
  };

  // Group flights by tail
  const tailGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        tail: string;
        baseCity: string;
        maxDelay: number;
        hasDisruption: boolean;
        legs: { raw: Flight; sim: FlightResult; baseline?: FlightResult }[];
      }
    > = {};

    for (const rf of rawFlights) {
      const sim = flightResults[rf.flight_id];
      const baseline = baselineResults ? baselineResults[rf.flight_id] : undefined;
      const tail = sim ? sim.tail : rf.tail_id;

      if (!groups[tail]) {
        groups[tail] = {
          tail,
          baseCity: rf.origin,
          maxDelay: 0,
          hasDisruption: false,
          legs: [],
        };
      }

      if (sim) {
        if (sim.arrDelay > groups[tail].maxDelay) {
          groups[tail].maxDelay = sim.arrDelay;
        }
        if (sim.arrDelay > 0 || sim.status === "cancelled") {
          groups[tail].hasDisruption = true;
        }
        groups[tail].legs.push({ raw: rf, sim, baseline });
      }
    }

    // Sort legs chronologically
    for (const g of Object.values(groups)) {
      g.legs.sort((a, b) => a.sim.schedDep - b.sim.schedDep);
    }

    let list = Object.values(groups);

    if (affectedOnly) {
      list = list.filter((g) => g.hasDisruption);
    }

    if (sortBy === "impact") {
      list.sort((a, b) => b.maxDelay - a.maxDelay || a.tail.localeCompare(b.tail));
    } else {
      list.sort((a, b) => a.tail.localeCompare(b.tail));
    }

    return list;
  }, [rawFlights, flightResults, baselineResults, sortBy, affectedOnly]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col rounded-card border border-skyborder bg-white shadow-subtle overflow-hidden">
        {/* Controls Bar: Sort, Filter, Legend */}
        <div className="flex flex-col gap-2.5 border-b border-skyborder/60 p-3.5 sm:flex-row sm:items-center sm:justify-between bg-surface">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-navy">Rotation Gantt</span>
            <span className="text-[11px] text-skymuted">
              ({tailGroups.length} aircraft chains)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortBy(sortBy === "impact" ? "tail" : "impact")}
              className="inline-flex items-center gap-1 rounded-control border border-skyborder bg-white px-2.5 py-1 text-[11px] font-semibold text-skytext hover:bg-slate-50 transition-colors"
            >
              <ArrowUpDown className="h-3 w-3 text-skyaccent" />
              <span>Sort: {sortBy === "impact" ? "By impact" : "By tail"}</span>
            </button>

            {/* Affected Only Filter */}
            <button
              type="button"
              onClick={() => setAffectedOnly(!affectedOnly)}
              className={`inline-flex items-center gap-1 rounded-control border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                affectedOnly
                  ? "border-skyaccent bg-blue-50 text-skyaccent"
                  : "border-skyborder bg-white text-skymuted hover:text-skytext hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3 w-3" />
              <span>Affected only</span>
            </button>

            {/* Legend Chips */}
            <div className="hidden lg:flex items-center gap-2 pl-2 text-[10px] font-semibold text-skymuted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2.5 rounded-[2px] bg-status-ontime" /> On-time
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2.5 rounded-[2px] bg-status-minor" /> 1–60m
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2.5 rounded-[2px] bg-status-severe" /> 61m+
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2.5 rounded-[2px] bg-status-spare" /> Spare
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Canvas */}
        <div className="relative overflow-x-auto">
          <div className="min-w-[960px] lg:min-w-[1040px] pb-4">
            {/* Sticky Time Axis */}
            <div className="sticky top-0 z-20 flex h-7 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs text-[10px] font-mono text-slate-500">
              <div className="w-[120px] shrink-0 border-r border-slate-200 px-3 py-1 font-medium text-slate-700">
                Aircraft
              </div>
              <div className="relative flex-1">
                {/* Single Closure chip anchored cleanly in the time axis (never covering row bars) */}
                {closure && (
                  <div
                    className="absolute top-1 -translate-x-1/2 flex items-center justify-center rounded bg-red-700 px-2 py-0.5 text-[9px] font-medium text-white shadow-xs z-30 pointer-events-auto"
                    style={{ left: `${getPercent((closure.start + closure.end) / 2)}%` }}
                    title={`${closure.airport} closed (${formatMinutesToTime(closure.start)}–${formatMinutesToTime(closure.end)})`}
                  >
                    {closure.airport} closed ({formatMinutesToTime(closure.start)}–{formatMinutesToTime(closure.end)})
                  </div>
                )}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${getPercent(h)}%` }}
                  >
                    <span className="py-1">{formatMinutesToTime(h)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows Container */}
            <div className="relative">
              {/* Shaded Hatch Closure Window across all rows (background only, zero text obstruction) */}
              {closure && (
                <div
                  className="pattern-hatch-closure pointer-events-none absolute top-0 bottom-0 z-10 border-x border-dashed border-status-severe/40"
                  style={{
                    left: `calc(120px + (100% - 120px) * ${getPercent(closure.start) / 100})`,
                    width: `calc((100% - 120px) * ${(closure.end - closure.start) / totalDuration})`,
                  }}
                />
              )}

              {/* Rows */}
              <div className="divide-y divide-skyborder/50">
                {tailGroups.map((group) => (
                  <div
                    key={group.tail}
                    className="relative flex h-9 items-center hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Tail Label Column */}
                    <div className="w-[120px] shrink-0 border-r border-skyborder/60 px-3 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-navy">
                        {group.tail}
                      </span>
                      {group.maxDelay > 0 && (
                        <span className="text-[10px] font-mono font-bold text-status-severe">
                          +{group.maxDelay}m
                        </span>
                      )}
                    </div>

                    {/* Bars Track */}
                    <div className="relative h-full flex-1">
                      {/* Vertical Hour Grid Lines */}
                      {hours.map((h) => (
                        <div
                          key={`line-${h}`}
                          className="pointer-events-none absolute top-0 bottom-0 border-r border-slate-100"
                          style={{ left: `${getPercent(h)}%` }}
                        />
                      ))}

                      {/* Flight Bars & Domino Connectors */}
                      {group.legs.map(({ raw, sim, baseline }, legIdx) => {
                        const isSelected = sim.flightId === selectedFlightId;
                        const isCancelled = sim.status === "cancelled";
                        const isSpareOperated = sim.tail !== raw.tail_id;

                        // Positions
                        const schedLeft = getPercent(sim.schedDep);
                        const schedWidth = Math.max(1, getPercent(sim.schedArr) - schedLeft);

                        const actualDep = sim.actualDep ?? sim.schedDep;
                        const actualArr = sim.actualArr ?? sim.schedArr;
                        const actLeft = getPercent(actualDep);
                        const actWidth = Math.max(1.8, getPercent(actualArr) - actLeft);

                        // Ghost bar of pre-fix baseline when recovery is applied
                        const showGhost =
                          isRecoveryApplied &&
                          baseline &&
                          (baseline.actualDep !== sim.actualDep ||
                            baseline.actualArr !== sim.actualArr);

                        const ghostLeft = baseline ? getPercent(baseline.actualDep ?? baseline.schedDep) : 0;
                        const ghostWidth = baseline
                          ? Math.max(1.8, getPercent(baseline.actualArr ?? baseline.schedArr) - ghostLeft)
                          : 0;

                        // Soft bar styling with 1px darker border
                        let barBg = "bg-status-ontime-bg border-status-ontime text-status-ontime";
                        if (isCancelled) {
                          barBg = "pattern-striped-cancelled border-slate-500 text-white";
                        } else if (isSpareOperated) {
                          barBg = "bg-status-spare-bg border-status-spare text-status-spare";
                        } else if (sim.arrDelay > 60) {
                          barBg = "bg-status-severe-bg border-status-severe text-status-severe";
                        } else if (sim.arrDelay > 0) {
                          barBg = "bg-status-minor-bg border-status-minor text-status-minor";
                        }

                        // Domino connector line to next leg if delayed
                        const nextLeg = group.legs[legIdx + 1];
                        const showDomino =
                          sim.arrDelay > 0 &&
                          nextLeg &&
                          nextLeg.sim.actualDep !== undefined;

                        return (
                          <React.Fragment key={sim.flightId}>
                            {/* Dotted Domino Cascade Connector */}
                            {showDomino && (
                              <div
                                className="pointer-events-none absolute top-4 h-[1px] border-t border-dashed border-status-minor/60 z-0"
                                style={{
                                  left: `${actLeft + actWidth}%`,
                                  width: `${Math.max(0, getPercent(nextLeg.sim.actualDep!) - (actLeft + actWidth))}%`,
                                }}
                              />
                            )}

                            {/* Scheduled Outline (dashed) */}
                            <div
                              className="pointer-events-none absolute top-1.5 h-6 rounded-[3px] border border-dashed border-slate-300 opacity-60"
                              style={{
                                left: `${schedLeft}%`,
                                width: `${schedWidth}%`,
                              }}
                              title={`Scheduled: ${formatMinutesToTime(sim.schedDep)}–${formatMinutesToTime(sim.schedArr)}`}
                            />

                            {/* Faint Ghost Bar (Pre-fix baseline) */}
                            {showGhost && (
                              <div
                                className="pointer-events-none absolute top-2.5 h-4 rounded-[3px] bg-slate-300/40 border border-slate-400/40 opacity-40 z-5"
                                style={{
                                  left: `${ghostLeft}%`,
                                  width: `${ghostWidth}%`,
                                }}
                                title="Pre-fix baseline position"
                              />
                            )}

                            {/* Actual Operated Bar */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => onSelectFlight(sim.flightId)}
                                  aria-label={`${sim.flightId} ${raw.origin} to ${raw.destination}, ${
                                    isCancelled
                                      ? "cancelled"
                                      : sim.arrDelay > 0
                                      ? `delayed ${sim.arrDelay} minutes`
                                      : "on time"
                                  }${sim.rootAirport ? `, caused by ${sim.rootAirport} closure` : ""}`}
                                  className={`absolute top-2 h-5 rounded-[4px] border px-1 text-[10px] font-mono font-medium leading-none flex items-center justify-center overflow-hidden shadow-subtle transition-colors hover:z-30 cursor-pointer ${barBg} ${
                                    isSelected
                                      ? "ring-2 ring-blue-700 ring-offset-1 z-30 font-semibold"
                                      : "z-10"
                                  } focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent`}
                                  style={{
                                    left: `${actLeft}%`,
                                    width: `${actWidth}%`,
                                  }}
                                >
                                  {/* Wide bar: show both Flight ID + Delay */}
                                  {actWidth >= 8.5 ? (
                                    <span className="flex items-center justify-between w-full px-0.5 whitespace-nowrap overflow-hidden">
                                      <span className="font-mono text-[10px] font-bold">{sim.flightId}</span>
                                      {sim.arrDelay > 0 && !isCancelled && (
                                        <span className="text-[9px] font-mono font-semibold ml-1">+{sim.arrDelay}m</span>
                                      )}
                                    </span>
                                  ) : actWidth >= 3.8 ? (
                                    /* Medium bar: show ONLY clean full Flight ID centered without truncation */
                                    <span className="whitespace-nowrap font-mono text-[10px] font-bold">
                                      {sim.flightId}
                                    </span>
                                  ) : null}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="space-y-1">
                                  <div className="font-bold font-mono">
                                    {sim.flightId} · {raw.origin} → {raw.destination}
                                  </div>
                                  <div className="text-[11px] opacity-90">
                                    Sched: {formatMinutesToTime(sim.schedDep)} → {formatMinutesToTime(sim.schedArr)}
                                  </div>
                                  <div className="text-[11px] opacity-90">
                                    Actual: {sim.actualDep !== undefined ? formatMinutesToTime(sim.actualDep) : "Cancelled"} → {sim.actualArr !== undefined ? formatMinutesToTime(sim.actualArr) : "Cancelled"}
                                  </div>
                                  {sim.arrDelay > 0 && (
                                    <div className="text-amber-300 font-bold text-[11px]">
                                      Arrival delay: +{sim.arrDelay} min
                                    </div>
                                  )}
                                  {sim.rootAirport && (
                                    <div className="text-[10px] text-slate-300">
                                      Root cause: {sim.rootAirport} closure
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
