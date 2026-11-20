"use client";

import React, { useState, useMemo } from "react";
import type { FlightResult, Flight } from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";
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
  const [sortKey, setSortKey] = useState<SortKey>("schedDep");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const flightsList = useMemo(() => {
    return rawFlights.map((rf) => {
      const sim = flightResults[rf.flight_id];
      return {
        flightId: rf.flight_id,
        tail: sim ? sim.tail : rf.tail_id,
        legOrder: rf.leg_order,
        origin: rf.origin,
        destination: rf.destination,
        route: `${rf.origin} → ${rf.destination}`,
        schedDep: sim ? sim.schedDep : 0,
        schedArr: sim ? sim.schedArr : 0,
        actualDep: sim?.actualDep,
        actualArr: sim?.actualArr,
        depDelay: sim ? sim.depDelay : 0,
        arrDelay: sim ? sim.arrDelay : 0,
        status: sim ? sim.status : "on_time",
        crewViolation: sim?.crewViolation ?? false,
        causes: sim ? sim.causes : [],
        pax: rf.pax,
      };
    });
  }, [rawFlights, flightResults]);

  // Filtering
  const filteredFlights = useMemo(() => {
    return flightsList.filter((f) => {
      if (filter === "delayed" && (f.arrDelay <= 0 || f.status === "cancelled")) return false;
      if (filter === "severe" && (f.arrDelay <= 60 || f.status === "cancelled")) return false;
      if (filter === "cancelled" && f.status !== "cancelled") return false;
      if (filter === "crew_violation" && !f.crewViolation) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesId = f.flightId.toLowerCase().includes(q);
        const matchesTail = f.tail.toLowerCase().includes(q);
        const matchesRoute = f.route.toLowerCase().includes(q);
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
    <div className="flex flex-col rounded-card border border-skyborder bg-white shadow-subtle overflow-hidden">
      {/* Header with Search and Filter Chips */}
      <div className="flex flex-col gap-3 border-b border-skyborder/60 p-3.5 sm:flex-row sm:items-center sm:justify-between bg-surface">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Flights" },
              { id: "delayed", label: "Delayed" },
              { id: "severe", label: "Severe (61m+)" },
              { id: "cancelled", label: "Cancelled" },
              { id: "crew_violation", label: "Crew Overruns" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`rounded-chip px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === chip.id
                  ? "bg-navy text-white shadow-subtle"
                  : "bg-slate-100 text-skymuted hover:text-skytext hover:bg-slate-200/70"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-skymuted" />
          <input
            type="text"
            aria-label="Search flights by flight number, tail ID, or city name"
            placeholder="Search flight, tail, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8.5 w-full sm:w-56 rounded-control border border-skyborder bg-white pl-8 pr-3 text-xs text-skytext shadow-subtle placeholder:text-skymuted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyaccent"
          />
        </div>
      </div>

      {/* Accessible Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            Complete schedule of 70 flight operations with status, delays, and causal chain analysis
          </caption>
          <thead>
            <tr className="sticky top-0 z-10 border-b border-skyborder bg-slate-50/90 text-skymuted font-semibold text-[11px] backdrop-blur-xs">
              <th scope="col" className="h-10 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("flightId")}
                  className="flex items-center gap-1 hover:text-skytext font-bold"
                >
                  Flight {sortKey === "flightId" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-10 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("tail")}
                  className="flex items-center gap-1 hover:text-skytext font-bold"
                >
                  Tail · Leg {sortKey === "tail" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-10 px-3">Route</th>
              <th scope="col" className="h-10 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("schedDep")}
                  className="flex items-center gap-1 hover:text-skytext font-bold"
                >
                  Sched Dep {sortKey === "schedDep" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-10 px-3">Actual Dep</th>
              <th scope="col" className="h-10 px-3">Sched Arr</th>
              <th scope="col" className="h-10 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("actualArr")}
                  className="flex items-center gap-1 hover:text-skytext font-bold"
                >
                  Actual Arr {sortKey === "actualArr" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-10 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("arrDelay")}
                  className="flex items-center gap-1 hover:text-skytext font-bold"
                >
                  Delay {sortKey === "arrDelay" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="h-10 px-3">Status</th>
              <th scope="col" className="h-10 px-3">Primary Cause</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-skyborder/60 text-skytext">
            {sortedFlights.length === 0 ? (
              <tr>
                <td colSpan={10} className="h-24 text-center text-skymuted">
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
                    ? "Spare aircraft swap"
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
                    className={`h-11 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50/80 font-medium text-navy ring-1 ring-inset ring-skyaccent"
                        : "hover:bg-slate-50/70"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-skyaccent`}
                  >
                    <td className="px-3 font-mono font-bold text-navy">
                      {f.flightId}
                    </td>
                    <td className="px-3 font-mono text-skymuted">
                      {f.tail} <span className="text-[10px] text-slate-400">L{f.legOrder}</span>
                    </td>
                    <td className="px-3 font-semibold text-skytext">
                      {f.origin} → {f.destination}
                    </td>
                    <td className="px-3 font-mono tabular-nums text-skymuted">
                      {formatMinutesToTime(f.schedDep)}
                    </td>
                    <td className="px-3 font-mono tabular-nums">
                      {f.actualDep !== undefined ? (
                        <span className={f.depDelay > 0 ? "font-semibold text-status-minor" : "text-skytext"}>
                          {formatMinutesToTime(f.actualDep)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 font-mono tabular-nums text-skymuted">
                      {formatMinutesToTime(f.schedArr)}
                    </td>
                    <td className="px-3 font-mono tabular-nums">
                      {f.actualArr !== undefined ? (
                        <span className={f.arrDelay > 0 ? "font-semibold text-status-severe" : "text-skytext"}>
                          {formatMinutesToTime(f.actualArr)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 font-mono tabular-nums font-bold">
                      {f.status === "cancelled" ? (
                        <span className="text-status-cancelled">CANCEL</span>
                      ) : f.arrDelay > 0 ? (
                        <span className={f.arrDelay > 60 ? "text-status-severe" : "text-status-minor"}>
                          +{f.arrDelay}m
                        </span>
                      ) : (
                        <span className="text-status-ontime font-medium">0m</span>
                      )}
                    </td>
                    <td className="px-3">
                      {f.status === "cancelled" ? (
                        <Badge variant="cancelled">
                          <XCircle className="h-3 w-3" />
                          Cancelled
                        </Badge>
                      ) : f.arrDelay > 60 ? (
                        <Badge variant="severe">
                          <AlertTriangle className="h-3 w-3" />
                          Severe
                        </Badge>
                      ) : f.arrDelay > 0 ? (
                        <Badge variant="minor">
                          <Clock className="h-3 w-3" />
                          Delayed
                        </Badge>
                      ) : (
                        <Badge variant="ontime">
                          <CheckCircle className="h-3 w-3" />
                          On Time
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 text-skymuted truncate max-w-[140px]" title={causeLabel}>
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
