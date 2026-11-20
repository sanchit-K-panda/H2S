"use client";

import React from "react";
import type { Airport } from "@/engine/types";
import { formatMinutesToTime, parseTimeToMinutes } from "@/engine/time";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { RotateCcw, CloudLightning, Plane } from "lucide-react";

export interface PresetScenario {
  id: string;
  label: string;
  airport: string;
  start: string; // HH:MM
  duration: number; // minutes
  subtitle: string;
  isDemo?: boolean;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "bom-benchmark",
    label: "Mumbai hub weather disruption",
    airport: "BOM",
    start: "08:00",
    duration: 120,
    subtitle: "Benchmark closure · 17 delayed, 115 stranded passengers",
    isDemo: true,
  },
  {
    id: "bom-storm-90m",
    label: "90-minute Mumbai weather closure",
    airport: "BOM",
    start: "08:00",
    duration: 90,
    subtitle: "Cascading rotation delay across primary network",
  },
  {
    id: "del-midday",
    label: "Delhi hub midday congestion",
    airport: "DEL",
    start: "11:00",
    duration: 120,
    subtitle: "North corridor hub ripple · 12 delayed flights",
  },
  {
    id: "blr-afternoon",
    label: "Bengaluru afternoon turnaround wave",
    airport: "BLR",
    start: "14:00",
    duration: 60,
    subtitle: "South hub turnarounds · 11 delayed flights",
  },
];

interface ScenarioPanelProps {
  airports: Airport[];
  selectedAirport: string;
  startTime: string; // HH:MM
  duration: number; // minutes
  onAirportChange: (airport: string) => void;
  onStartTimeChange: (time: string) => void;
  onDurationChange: (duration: number) => void;
  onReset: () => void;
}

export function ScenarioPanel({
  airports,
  selectedAirport,
  startTime,
  duration,
  onAirportChange,
  onStartTimeChange,
  onDurationChange,
  onReset,
}: ScenarioPanelProps) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const endTimeFormatted = formatMinutesToTime(endMinutes);

  const durationHours = Math.floor(duration / 60);
  const durationRemainderMins = duration % 60;
  const durationHuman =
    durationHours > 0
      ? `${durationHours}h ${durationRemainderMins > 0 ? `${durationRemainderMins}m` : "00m"}`
      : `${duration}m`;

  const selectedAirportObj = airports.find((a) => a.id === selectedAirport);

  return (
    <Card className="flex flex-col h-full bg-surface border-slate-200 shadow-subtle">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <CloudLightning className="h-4 w-4 text-slate-500" />
            Disruption scenario
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Airport weather closure parameters
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-slate-900"
          title="Reset to default benchmark"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-3.5">
        {/* Preset Rows */}
        <div>
          <span className="text-[11px] font-medium text-slate-500">
            Presets
          </span>
          <div className="mt-1.5 space-y-1.5">
            {PRESET_SCENARIOS.map((p) => {
              const isMatch =
                p.airport === selectedAirport &&
                p.start === startTime &&
                p.duration === duration;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onAirportChange(p.airport);
                    onStartTimeChange(p.start);
                    onDurationChange(p.duration);
                  }}
                  className={`w-full text-left rounded-control border p-2.5 transition-colors text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent ${
                    isMatch
                      ? "border-slate-800 bg-slate-50 text-slate-900 shadow-xs ring-1 ring-slate-800/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs leading-none">
                      {p.label}
                    </span>
                    {p.isDemo && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                        Benchmark
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                    {p.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Airport Select */}
        <div className="space-y-1">
          <label
            htmlFor="airport-selector"
            className="block text-[11px] font-medium text-slate-500"
          >
            Closed airport
          </label>
          <Select value={selectedAirport} onValueChange={onAirportChange}>
            <SelectTrigger id="airport-selector" className="h-9">
              <SelectValue placeholder="Select airport" />
            </SelectTrigger>
            <SelectContent>
              {airports.map((ap) => (
                <SelectItem key={ap.id} value={ap.id}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span className="font-medium font-mono text-slate-900">
                      {ap.id} · {ap.city}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {ap.tier === "mega_hub"
                        ? "Mega hub"
                        : ap.tier === "regional_hub"
                        ? "Regional hub"
                        : "Spoke"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAirportObj && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
              <Plane className="h-3 w-3 text-slate-400" />
              <span>{selectedAirportObj.name}</span>
            </div>
          )}
        </div>

        {/* Start Time */}
        <div className="space-y-1">
          <label
            htmlFor="closure-start-time"
            className="block text-[11px] font-medium text-slate-500"
          >
            Closure start (IST)
          </label>
          <input
            type="time"
            id="closure-start-time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="h-9 w-full rounded-control border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono font-medium tabular-nums text-slate-900 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent"
          />
        </div>

        {/* Duration Slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-medium text-slate-500">
              Duration
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium font-mono text-slate-800">
              {durationHuman}
            </span>
          </div>

          <Slider
            value={[duration]}
            min={15}
            max={360}
            step={15}
            onValueChange={([val]) => onDurationChange(val)}
            aria-label="Closure duration in minutes"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>15m</span>
            <span className="font-medium text-slate-700">
              Window: {startTime} → {endTimeFormatted}
            </span>
            <span>6h (360m)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
