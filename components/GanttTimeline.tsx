"use client";

import React, { useMemo } from "react";
import type { FlightResult, Flight, Closure } from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";

interface GanttTimelineProps {
  flightResults: Record<string, FlightResult>;
  rawFlights: Flight[];
  closure?: Closure;
  selectedFlightId?: string;
  onSelectFlight: (flightId: string) => void;
}

export function GanttTimeline({
  flightResults,
  rawFlights,
  closure,
  selectedFlightId,
  onSelectFlight,
}: GanttTimelineProps) {
  // Timeline boundaries: 05:00 (300m) to 23:00 (1380m) = 1080 min total
  const minTime = 300;
  const maxTime = 1380;
  const totalDuration = maxTime - minTime;

  // Group flights by aircraft tail
  const tailGroups = useMemo(() => {
    const groups: Record<string, { raw: Flight; sim: FlightResult }[]> = {};

    for (const rf of rawFlights) {
      const sim = flightResults[rf.flight_id];
      const tail = sim ? sim.tail : rf.tail_id;
      if (!groups[tail]) {
        groups[tail] = [];
      }
      if (sim) {
        groups[tail].push({ raw: rf, sim });
      }
    }

    // Sort legs within each tail by schedDep
    for (const tail of Object.keys(groups)) {
      groups[tail].sort((a, b) => a.sim.schedDep - b.sim.schedDep);
    }

    return Object.entries(groups).sort(([tailA], [tailB]) =>
      tailA.localeCompare(tailB)
    );
  }, [rawFlights, flightResults]);

  // Hourly grid markers from 05:00 to 23:00
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Aircraft Rotation Gantt &amp; Cascade Timeline
          </h2>
          <p className="text-xs text-slate-500">
            Compare scheduled outline vs actual operated bar across each aircraft chain
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-xs bg-emerald-500" />
            <span>On Time</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-xs bg-amber-500" />
            <span>1–60m Delay</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-xs bg-rose-500" />
            <span>61m+ Delay</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-xs bg-purple-500" />
            <span>Cancelled</span>
          </div>
          {closure && (
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-xs bg-rose-200 border border-dashed border-rose-400" />
              <span>{closure.airport} Closed</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Time Header Scale */}
          <div className="relative h-6 border-b border-slate-200 text-[10px] font-mono text-slate-500">
            <div className="absolute left-0 w-20 font-bold">AIRCRAFT</div>
            <div className="absolute left-20 right-0 h-full">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${getPercent(h)}%` }}
                >
                  <span className="border-l border-slate-200 pl-1 h-3 inline-block">
                    {formatMinutesToTime(h)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tails Rows */}
          <div className="relative mt-2 divide-y divide-slate-100">
            {/* Shaded closure window backdrop */}
            {closure && (
              <div
                className="absolute top-0 bottom-0 z-0 bg-rose-100/40 border-x border-dashed border-rose-300 pointer-events-none"
                style={{
                  left: `calc(5rem + (100% - 5rem) * ${getPercent(closure.start) / 100})`,
                  width: `calc((100% - 5rem) * ${(closure.end - closure.start) / totalDuration})`,
                }}
              >
                <span className="absolute top-1 left-1.5 text-[9px] font-bold text-rose-700 uppercase tracking-wider">
                  {closure.airport} Closed ({formatMinutesToTime(closure.start)}–{formatMinutesToTime(closure.end)})
                </span>
              </div>
            )}

            {tailGroups.map(([tailId, flights]) => (
              <div key={tailId} className="relative flex h-10 items-center hover:bg-slate-50/50">
                {/* Tail Label */}
                <div className="w-20 shrink-0 font-mono text-xs font-bold text-slate-800">
                  {tailId}
                </div>

                {/* Bars track */}
                <div className="relative h-full flex-1">
                  {flights.map(({ raw, sim }) => {
                    const isSelected = sim.flightId === selectedFlightId;
                    const isCancelled = sim.status === "cancelled";

                    // Scheduled position
                    const schedLeft = getPercent(sim.schedDep);
                    const schedWidth = Math.max(
                      1.5,
                      getPercent(sim.schedArr) - schedLeft
                    );

                    // Actual position
                    const actualDep = sim.actualDep ?? sim.schedDep;
                    const actualArr = sim.actualArr ?? sim.schedArr;
                    const actLeft = getPercent(actualDep);
                    const actWidth = Math.max(1.5, getPercent(actualArr) - actLeft);

                    const delayColor = isCancelled
                      ? "bg-purple-500 text-white"
                      : sim.arrDelay > 60
                      ? "bg-rose-500 text-white"
                      : sim.arrDelay > 0
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500 text-white";

                    return (
                      <React.Fragment key={sim.flightId}>
                        {/* Scheduled ghost outline */}
                        <div
                          className="absolute top-1 h-3 rounded-xs border border-dashed border-slate-300 pointer-events-none opacity-60"
                          style={{
                            left: `${schedLeft}%`,
                            width: `${schedWidth}%`,
                          }}
                          title={`Scheduled: ${formatMinutesToTime(sim.schedDep)} - ${formatMinutesToTime(sim.schedArr)}`}
                        />

                        {/* Actual operated bar */}
                        <button
                          type="button"
                          onClick={() => onSelectFlight(sim.flightId)}
                          aria-label={`${sim.flightId} ${raw.origin} to ${raw.destination}, ${sim.status}, ${
                            sim.arrDelay > 0 ? `delayed ${sim.arrDelay} minutes` : "on time"
                          }${sim.rootAirport ? `, caused by ${sim.rootAirport} closure` : ""}`}
                          className={`absolute top-4 h-4 rounded-xs px-1 text-[9px] font-mono font-bold leading-none flex items-center justify-between overflow-hidden shadow-xs transition-transform hover:scale-[1.03] hover:z-20 ${delayColor} ${
                            isSelected
                              ? "ring-2 ring-slate-900 ring-offset-1 z-30 font-extrabold"
                              : "z-10"
                          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                          style={{
                            left: `${actLeft}%`,
                            width: `${actWidth}%`,
                          }}
                        >
                          <span className="truncate">{sim.flightId}</span>
                          {sim.arrDelay > 0 && !isCancelled && (
                            <span className="text-[8px] opacity-90 ml-0.5">+{sim.arrDelay}</span>
                          )}
                        </button>
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
  );
}
