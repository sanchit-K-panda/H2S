"use client";

import React, { useState, useMemo } from "react";
import type { FlightResult, Flight } from "@/engine/types";
import { formatMinutesToTime, parseTimeToMinutes } from "@/engine/time";
import { Badge } from "./ui/badge";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";

interface FlightsTableProps {
  flightResults: Record<string, FlightResult>;
  rawFlights: Flight[];
  selectedFlightId?: string;
  onSelectFlight: (flightId: string) => void;
}

type FilterChip = "all" | "delayed" | "severe" | "cancelled" | "crew_violation";
type SortKey =
  | "flightId"
  | "tail"
  | "route"
  | "schedDep"
  | "actualArr"
  | "arrDelay"
  | "status";

export function FlightsTable({
  flightResults,
  rawFlights,
  selectedFlightId,
  onSelectFlight,
}: FlightsTableProps) {
  const [filter, setFilter] = useState<FilterChip>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("arrDelay");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Combine raw flight schedule with dynamic simulation results
  const flightsList = useMemo(() => {
    return rawFlights.map((rf) => {
      const sim = flightResults[rf.flight_id];
      const delay = sim?.arrDelay ?? 0;
      const status = sim?.status ?? "ontime";
      const isSpare = sim ? sim.tail !== rf.tail_id : false;

      return {
        flightId: rf.flight_id,
        tail: sim?.tail ?? rf.tail_id,
        originalTail: rf.tail_id,
        isSpare,
        origin: rf.origin,
        destination: rf.destination,
        route: `${rf.origin} → ${rf.destination}`,
        schedDep: sim?.schedDep ?? parseTimeToMinutes(rf.dep),
        schedArr: sim?.schedArr ?? parseTimeToMinutes(rf.arr),
        actualDep: sim?.actualDep,
        actualArr: sim?.actualArr,
        arrDelay: delay,
        depDelay: sim?.depDelay ?? 0,
        status: isSpare ? "spare" : status,
        causes: sim?.causes ?? [],
        legOrder: rf.leg_order,
        pax: rf.pax,
      };
    });
  }, [rawFlights, flightResults]);

  // Filter counts
  const counts = useMemo(() => {
    let delayed = 0;
    let severe = 0;
    let cancelled = 0;
    let crew = 0;
    for (const f of flightsList) {
      if (f.arrDelay > 0) delayed++;
      if (f.arrDelay > 60) severe++;
      if (f.status === "cancelled") cancelled++;
      if (f.arrDelay > 60) crew++; // severe flights correlate with duty risk
    }
    return { all: flightsList.length, delayed, severe, cancelled, crew };
  }, [flightsList]);

  // Filtering
  const filteredFlights = useMemo(() => {
    return flightsList.filter((f) => {
      if (filter === "delayed" && f.arrDelay <= 0) return false;
      if (filter === "severe" && f.arrDelay <= 60) return false;
      if (filter === "cancelled" && f.status !== "cancelled") return false;
      if (filter === "crew_violation" && f.arrDelay <= 60) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesId = f.flightId.toLowerCase().includes(query);
        const matchesTail = f.tail.toLowerCase().includes(query);
        const matchesRoute =
          f.origin.toLowerCase().includes(query) ||
          f.destination.toLowerCase().includes(query);
        return matchesId || matchesTail || matchesRoute;
      }
      return true;
    });
  }, [flightsList, filter, search]);

  // Sorting
  const sortedFlights = useMemo(() => {
    return [...filteredFlights].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "flightId":
          cmp = a.flightId.localeCompare(b.flightId);
          break;
        case "tail":
          cmp = a.tail.localeCompare(b.tail) || a.legOrder - b.legOrder;
          break;
        case "route":
          cmp = a.route.localeCompare(b.route);
          break;
        case "schedDep":
          cmp = a.schedDep - b.schedDep;
          break;
        case "actualArr":
          cmp = (a.actualArr ?? a.schedArr) - (b.actualArr ?? b.schedArr);
          break;
        case "arrDelay":
          cmp = a.arrDelay - b.arrDelay;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filteredFlights, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div className="flex flex-col rounded-card border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      {/* Header with Search and Filter Chips */}
      <div className="flex flex-col gap-2.5 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Flights", count: counts.all },
              { id: "delayed", label: "Delayed", count: counts.delayed },
              { id: "severe", label: "Severe (61m+)", count: counts.severe },
              { id: "cancelled", label: "Cancelled", count: counts.cancelled },
              { id: "crew_violation", label: "Crew Risk", count: counts.crew },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold transition-all ${
                filter === chip.id
                  ? "bg-navy text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100/70"
              }`}
            >
              <span>{chip.label}</span>
              <span
                className={`rounded-chip px-1.5 py-0.2 text-[10px] font-mono ${
                  filter === chip.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            aria-label="Search flights by flight number, tail ID, or city name"
            placeholder="Filter flight, tail, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full sm:w-56 rounded-control border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyaccent"
          />
        </div>
      </div>

      {/* Accessible, Uncongested Table (Horizontal scroll on narrow screens with no ugly cell wraps) */}
      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Complete schedule of 70 flight operations with status, delays, and causal chain analysis
          </caption>
          <thead>
            <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <th scope="col" className="h-9 px-3.5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("flightId")}
                  className="flex items-center gap-1 hover:text-navy font-bold"
                >
                  Flight {sortKey === "flightId" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("tail")}
                  className="flex items-center gap-1 hover:text-navy font-bold"
                >
                  Tail · Leg {sortKey === "tail" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap">Route</th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("schedDep")}
                  className="flex items-center gap-1 hover:text-navy font-bold"
                >
                  Departure {sortKey === "schedDep" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort("actualArr")}
                  className="flex items-center gap-1 hover:text-navy font-bold"
                >
                  Arrival {sortKey === "actualArr" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap text-right">
                <button
                  type="button"
                  onClick={() => handleSort("arrDelay")}
                  className="flex items-center gap-1 hover:text-navy font-bold ml-auto"
                >
                  Delay {sortKey === "arrDelay" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-9 px-3 whitespace-nowrap text-center">Status</th>
              <th scope="col" className="h-9 px-3.5 whitespace-nowrap">Primary Cause</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedFlights.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-24 text-center text-slate-400">
                  No flights match the current filter criteria.
                </td>
              </tr>
            ) : (
              sortedFlights.map((f) => {
                const isSelected = f.flightId === selectedFlightId;
                const causeLabel =
                  f.status === "cancelled"
                    ? "Cancelled by recovery action"
                    : f.causes.some((c) => c.kind === "weather_closure")
                    ? "Weather closure at airport"
                    : f.causes.some((c) => c.kind === "aircraft_rotation")
                    ? "Rotational delay from prior leg"
                    : f.causes.some((c) => c.kind === "spare_assignment")
                    ? "Standby spare aircraft swap"
                    : "On schedule";

                return (
                  <tr
                    key={f.flightId}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelectFlight(f.flightId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectFlight(f.flightId);
                      }
                    }}
                    aria-label={`Flight ${f.flightId} ${f.origin} to ${f.destination}, ${f.status}`}
                    className={`h-10 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50/90 font-medium text-navy border-l-2 border-l-skyaccent"
                        : "hover:bg-slate-50/80"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-skyaccent`}
                  >
                    {/* Flight ID */}
                    <td className="px-3.5 whitespace-nowrap font-mono font-bold text-navy">
                      {f.flightId}
                    </td>

                    {/* Tail & Leg (Clean single line, never wrapped) */}
                    <td className="px-3 whitespace-nowrap font-mono text-slate-600">
                      <span>{f.tail}</span>
                      <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.2 text-[10px] font-semibold text-slate-500">
                        L{f.legOrder}
                      </span>
                      {f.isSpare && (
                        <span className="ml-1 rounded bg-purple-100 px-1 py-0.2 text-[9px] font-bold text-purple-700">
                          SPARE
                        </span>
                      )}
                    </td>

                    {/* Route (Clean single line, never wrapped) */}
                    <td className="px-3 whitespace-nowrap font-semibold text-slate-800">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono font-bold">
                        {f.origin}
                      </span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono font-bold">
                        {f.destination}
                      </span>
                    </td>

                    {/* Departure (Sched -> Actual) */}
                    <td className="px-3 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      <span className="text-slate-400">{formatMinutesToTime(f.schedDep)}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <span className={f.depDelay > 0 ? "font-bold text-amber-600" : "text-slate-700"}>
                        {f.actualDep !== undefined ? formatMinutesToTime(f.actualDep) : "—"}
                      </span>
                    </td>

                    {/* Arrival (Sched -> Actual) */}
                    <td className="px-3 whitespace-nowrap font-mono tabular-nums text-slate-600">
                      <span className="text-slate-400">{formatMinutesToTime(f.schedArr)}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <span
                        className={
                          f.arrDelay > 60
                            ? "font-bold text-rose-600"
                            : f.arrDelay > 0
                            ? "font-bold text-amber-600"
                            : "text-slate-700"
                        }
                      >
                        {f.actualArr !== undefined ? formatMinutesToTime(f.actualArr) : "—"}
                      </span>
                    </td>

                    {/* Delay Minutes */}
                    <td className="px-3 whitespace-nowrap font-mono tabular-nums font-bold text-right">
                      {f.status === "cancelled" ? (
                        <span className="text-slate-400">—</span>
                      ) : f.arrDelay > 60 ? (
                        <span className="text-rose-600">+{f.arrDelay}m</span>
                      ) : f.arrDelay > 0 ? (
                        <span className="text-amber-600">+{f.arrDelay}m</span>
                      ) : (
                        <span className="text-emerald-600">0m</span>
                      )}
                    </td>

                    {/* Status Pill */}
                    <td className="px-3 whitespace-nowrap text-center">
                      {f.status === "cancelled" ? (
                        <Badge variant="cancelled" className="gap-1 text-[10px]">
                          <XCircle className="h-3 w-3" />
                          <span>Cancelled</span>
                        </Badge>
                      ) : f.arrDelay > 60 ? (
                        <Badge variant="severe" className="gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Severe</span>
                        </Badge>
                      ) : f.arrDelay > 0 ? (
                        <Badge variant="minor" className="gap-1 text-[10px]">
                          <Clock className="h-3 w-3" />
                          <span>Minor</span>
                        </Badge>
                      ) : (
                        <Badge variant="ontime" className="gap-1 text-[10px]">
                          <CheckCircle className="h-3 w-3" />
                          <span>On-Time</span>
                        </Badge>
                      )}
                    </td>

                    {/* Primary Cause */}
                    <td className="px-3.5 whitespace-nowrap text-[11px] text-slate-500">
                      {causeLabel}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
