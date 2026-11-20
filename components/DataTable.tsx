"use client";

import React, { useState, useMemo } from "react";
import type { FlightResult, Flight } from "@/engine/types";
import { formatMinutesToTime } from "@/engine/time";

interface DataTableProps {
  flightResults: Record<string, FlightResult>;
  rawFlights: Flight[];
  selectedFlightId?: string;
  onSelectFlight: (flightId: string) => void;
}

type SortField =
  | "flightId"
  | "tail"
  | "origin"
  | "destination"
  | "schedDep"
  | "actualArr"
  | "arrDelay"
  | "status";
type SortOrder = "asc" | "desc";

export function DataTable({
  flightResults,
  rawFlights,
  selectedFlightId,
  onSelectFlight,
}: DataTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "delayed" | "on_time" | "cancelled">("all");
  const [sortField, setSortField] = useState<SortField>("schedDep");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const flightsList = useMemo(() => {
    return rawFlights.map((rf) => {
      const sim = flightResults[rf.flight_id];
      return {
        flightId: rf.flight_id,
        tailId: sim ? sim.tail : rf.tail_id,
        legOrder: rf.leg_order,
        origin: rf.origin,
        destination: rf.destination,
        schedDep: sim ? sim.schedDep : 0,
        schedArr: sim ? sim.schedArr : 0,
        actualDep: sim?.actualDep,
        actualArr: sim?.actualArr,
        depDelay: sim ? sim.depDelay : 0,
        arrDelay: sim ? sim.arrDelay : 0,
        status: sim ? sim.status : "on_time",
        rootAirport: sim?.rootAirport,
        causes: sim ? sim.causes : [],
        pax: rf.pax,
        crewViolation: sim?.crewViolation ?? false,
      };
    });
  }, [rawFlights, flightResults]);

  // Filtering
  const filteredFlights = useMemo(() => {
    return flightsList.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = f.flightId.toLowerCase().includes(query);
        const matchesTail = f.tailId.toLowerCase().includes(query);
        const matchesRoute =
          f.origin.toLowerCase().includes(query) ||
          f.destination.toLowerCase().includes(query);
        return matchesId || matchesTail || matchesRoute;
      }
      return true;
    });
  }, [flightsList, statusFilter, searchQuery]);

  // Sorting
  const sortedFlights = useMemo(() => {
    return [...filteredFlights].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "flightId":
          comparison = a.flightId.localeCompare(b.flightId);
          break;
        case "tail":
          comparison = a.tailId.localeCompare(b.tailId) || a.legOrder - b.legOrder;
          break;
        case "origin":
          comparison = a.origin.localeCompare(b.origin);
          break;
        case "destination":
          comparison = a.destination.localeCompare(b.destination);
          break;
        case "schedDep":
          comparison = a.schedDep - b.schedDep;
          break;
        case "actualArr":
          comparison = (a.actualArr ?? a.schedArr) - (b.actualArr ?? b.schedArr);
          break;
        case "arrDelay":
          comparison = a.arrDelay - b.arrDelay;
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredFlights, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Flight Operations Ledger</h2>
          <p className="text-xs text-slate-500">
            Accessible schedule, status, and delay cause analysis across all 70 flights
          </p>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium text-slate-600">
            {(["all", "delayed", "on_time", "cancelled"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                  statusFilter === tab
                    ? "bg-slate-900 text-white font-semibold"
                    : "hover:bg-slate-50"
                }`}
              >
                {tab.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search flight or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter flights table by ID or airport code"
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">
            Complete flight list with scheduled vs actual times, delay minutes, and cause breakdown
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
              <th
                scope="col"
                className="p-2.5"
                aria-sort={sortField === "flightId" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => handleSort("flightId")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Flight {sortField === "flightId" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">
                <button
                  type="button"
                  onClick={() => handleSort("tail")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Tail / Leg {sortField === "tail" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">Route</th>
              <th scope="col" className="p-2.5">
                <button
                  type="button"
                  onClick={() => handleSort("schedDep")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Sched Dep {sortField === "schedDep" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">Actual Dep</th>
              <th scope="col" className="p-2.5">Sched Arr</th>
              <th scope="col" className="p-2.5">
                <button
                  type="button"
                  onClick={() => handleSort("actualArr")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Actual Arr {sortField === "actualArr" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">
                <button
                  type="button"
                  onClick={() => handleSort("arrDelay")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Arr Delay {sortField === "arrDelay" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Status {sortField === "status" && (sortOrder === "asc" ? "▲" : "▼")}
                </button>
              </th>
              <th scope="col" className="p-2.5">Primary Cause</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedFlights.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-500">
                  No flights match the current filter or search criteria.
                </td>
              </tr>
            ) : (
              sortedFlights.map((f) => {
                const isSelected = f.flightId === selectedFlightId;
                const causeLabel =
                  f.status === "cancelled"
                    ? "Cancelled by action"
                    : f.causes.some((c) => c.kind === "weather_closure")
                    ? `Weather (${f.rootAirport})`
                    : f.causes.some((c) => c.kind === "aircraft_rotation")
                    ? "Rotation delay"
                    : f.causes.some((c) => c.kind === "spare_assignment")
                    ? "Spare aircraft assigned"
                    : "On schedule";

                return (
                  <tr
                    key={f.flightId}
                    onClick={() => onSelectFlight(f.flightId)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectFlight(f.flightId);
                      }
                    }}
                    aria-label={`Select flight ${f.flightId} from ${f.origin} to ${f.destination}, ${f.status}`}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-sky-50 font-medium text-sky-950"
                        : "hover:bg-slate-50/80"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500`}
                  >
                    <td className="p-2.5 font-mono font-bold text-slate-900">
                      {f.flightId}
                    </td>
                    <td className="p-2.5 font-mono text-slate-600">
                      {f.tailId} <span className="text-[10px] text-slate-400">L{f.legOrder}</span>
                    </td>
                    <td className="p-2.5 font-semibold text-slate-800">
                      {f.origin} → {f.destination}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums text-slate-600">
                      {formatMinutesToTime(f.schedDep)}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums">
                      {f.actualDep !== undefined ? (
                        <span className={f.depDelay > 0 ? "font-semibold text-amber-700" : "text-slate-700"}>
                          {formatMinutesToTime(f.actualDep)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums text-slate-600">
                      {formatMinutesToTime(f.schedArr)}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums">
                      {f.actualArr !== undefined ? (
                        <span className={f.arrDelay > 0 ? "font-semibold text-rose-700" : "text-slate-700"}>
                          {formatMinutesToTime(f.actualArr)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2.5 font-mono tabular-nums">
                      {f.status === "cancelled" ? (
                        <span className="font-semibold text-purple-700">CANCEL</span>
                      ) : f.arrDelay > 0 ? (
                        <span className="font-semibold text-rose-700">+{f.arrDelay}m</span>
                      ) : (
                        <span className="font-medium text-emerald-700">0m</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {f.status === "cancelled" ? (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-600/20">
                          Cancelled
                        </span>
                      ) : f.arrDelay > 0 ? (
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-600/20">
                          Delayed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                          On Time
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-600 truncate max-w-[140px]" title={causeLabel}>
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
