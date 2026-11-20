"use client";

import React from "react";
import type { Airport } from "@/engine/types";
import { formatMinutesToTime, parseTimeToMinutes } from "@/engine/time";

export interface PresetScenario {
  label: string;
  airport: string;
  start: string; // HH:MM
  duration: number; // minutes
  description?: string;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    label: "BOM 08:00–10:00 (Demo)",
    airport: "BOM",
    start: "08:00",
    duration: 120,
    description: "Benchmark: 17 delayed, 115 stranded pax",
  },
  {
    label: "BOM 08:00–09:30 (90m Storm)",
    airport: "BOM",
    start: "08:00",
    duration: 90,
    description: "Real problem statement 90-min thunderstorm",
  },
  {
    label: "DEL 11:00–13:00",
    airport: "DEL",
    start: "11:00",
    duration: 120,
    description: "North hub midday disruption: 12 delayed",
  },
  {
    label: "BLR 14:00–15:00",
    airport: "BLR",
    start: "14:00",
    duration: 60,
    description: "South hub afternoon wave: 11 delayed",
  },
];

interface ControlPanelProps {
  airports: Airport[];
  selectedAirport: string;
  startTime: string; // "HH:MM"
  duration: number; // minutes
  onAirportChange: (airport: string) => void;
  onStartTimeChange: (time: string) => void;
  onDurationChange: (duration: number) => void;
  onRunSimulation: () => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function ControlPanel({
  airports,
  selectedAirport,
  startTime,
  duration,
  onAirportChange,
  onStartTimeChange,
  onDurationChange,
  onRunSimulation,
  onReset,
  isLoading = false,
}: ControlPanelProps) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const endTimeFormatted = formatMinutesToTime(endMinutes);

  const durationHours = Math.floor(duration / 60);
  const durationRemainderMins = duration % 60;
  const durationHuman =
    durationHours > 0
      ? `${durationHours}h ${durationRemainderMins > 0 ? `${durationRemainderMins}m` : ""}`.trim()
      : `${duration}m`;

  const selectedAirportObj = airports.find((a) => a.id === selectedAirport);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Disruption Controls</h2>
          <p className="text-xs text-slate-500">Configure airport closure parameters</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Reset simulation to baseline with no closures"
        >
          Reset
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quick Presets
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {PRESET_SCENARIOS.map((p) => {
            const isMatch =
              p.airport === selectedAirport &&
              p.start === startTime &&
              p.duration === duration;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  onAirportChange(p.airport);
                  onStartTimeChange(p.start);
                  onDurationChange(p.duration);
                }}
                className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                  isMatch
                    ? "border-sky-500 bg-sky-50/70 text-sky-950 shadow-xs ring-1 ring-sky-500"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
              >
                <span className="text-xs font-semibold">{p.label}</span>
                {p.description && (
                  <span className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">
                    {p.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRunSimulation();
        }}
        className="mt-5 space-y-4"
      >
        {/* Airport Select */}
        <div>
          <label
            htmlFor="airport-select"
            className="block text-xs font-semibold text-slate-700"
          >
            Closed Airport
          </label>
          <div className="relative mt-1">
            <select
              id="airport-select"
              value={selectedAirport}
              onChange={(e) => onAirportChange(e.target.value)}
              aria-describedby="airport-desc"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-xs transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {airports.map((ap) => (
                <option key={ap.id} value={ap.id}>
                  {ap.city} ({ap.id}) — {ap.name}
                </option>
              ))}
            </select>
          </div>
          {selectedAirportObj && (
            <p id="airport-desc" className="mt-1 text-xs text-slate-500">
              {selectedAirportObj.tier.replace("_", " ").toUpperCase()} • {selectedAirportObj.capacity_per_hour} flights/hr capacity
            </p>
          )}
        </div>

        {/* Start Time */}
        <div>
          <label
            htmlFor="start-time-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Closure Start Time (IST)
          </label>
          <div className="mt-1">
            <input
              type="time"
              id="start-time-input"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              aria-describedby="start-time-desc"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>
          <p id="start-time-desc" className="mt-1 text-xs text-slate-500">
            Closure begins at {startTime} IST
          </p>
        </div>

        {/* Duration Slider */}
        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="duration-slider"
              className="text-xs font-semibold text-slate-700"
            >
              Closure Duration
            </label>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-800">
              {duration} min ({durationHuman})
            </span>
          </div>
          <div className="mt-2">
            <input
              type="range"
              id="duration-slider"
              min="15"
              max="360"
              step="15"
              value={duration}
              aria-valuemin={15}
              aria-valuemax={360}
              aria-valuenow={duration}
              aria-valuetext={`${duration} minutes (${durationHuman})`}
              onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
              aria-describedby="duration-desc"
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
            <span>15 min</span>
            <span className="font-medium text-sky-700">
              Reopens at {endTimeFormatted} IST
            </span>
            <span>6 hrs (360m)</span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Evaluating Ripple...
              </span>
            ) : (
              "Simulate Cascade & Dispatch"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
