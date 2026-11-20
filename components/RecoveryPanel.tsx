"use client";

import React from "react";
import type { RecoveryOption } from "@/engine/types";

interface RecoveryPanelProps {
  options: RecoveryOption[];
  selectedOptionId?: string;
  isRecoveryApplied: boolean;
  onSelectOption: (optionId: string) => void;
  onToggleApplyRecovery: () => void;
}

export function RecoveryPanel({
  options,
  selectedOptionId,
  isRecoveryApplied,
  onSelectOption,
  onToggleApplyRecovery,
}: RecoveryPanelProps) {
  if (!options || options.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
        <h2 className="text-sm font-semibold text-slate-900">Recovery Interventions</h2>
        <p className="mt-1 text-xs text-slate-500">
          Run a disruption simulation to generate ranked candidate recovery actions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header with Before / After Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Recovery Recommendations
          </h2>
          <p className="text-xs text-slate-500">
            Deterministic candidate rankings evaluated against {options.length} alternatives
          </p>
        </div>

        {/* Before / After View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">View Mode:</span>
          <button
            type="button"
            onClick={onToggleApplyRecovery}
            aria-pressed={isRecoveryApplied}
            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              isRecoveryApplied
                ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
          >
            {isRecoveryApplied ? "✓ Showing AFTER Recovery" : "Showing BEFORE (Baseline Disruption)"}
          </button>
        </div>
      </div>

      {/* Top 3 Candidate Options */}
      <div className="mt-4 space-y-2.5">
        {options.slice(0, 3).map((opt, index) => {
          const isSelected = (selectedOptionId || options[0].id) === opt.id;
          const isSpare = opt.action.type === "spare";

          return (
            <div
              key={opt.id}
              onClick={() => onSelectOption(opt.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectOption(opt.id);
                }
              }}
              aria-label={`Rank #${index + 1}: ${opt.label}, cuts stranded pax by ${Math.abs(opt.delta.strandedPax)}`}
              className={`rounded-lg border p-3.5 transition-all text-left cursor-pointer ${
                isSelected
                  ? "border-sky-500 bg-sky-50/50 shadow-xs ring-1 ring-sky-500"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center rounded-full text-[11px] font-bold h-5 w-5 ${
                        index === 0
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-400"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {opt.label}
                    </span>
                    {index === 0 && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        TOP RECOMMENDATION
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    Action ID: {opt.id} • Type: {isSpare ? "Spare Takeover" : "Leg Cancellation"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOption(opt.id);
                    if (!isRecoveryApplied) {
                      onToggleApplyRecovery();
                    }
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    isSelected && isRecoveryApplied
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                >
                  {isSelected && isRecoveryApplied ? "Active" : "Apply Fix"}
                </button>
              </div>

              {/* Delta KPI Chips */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {/* Stranded Pax Delta */}
                <div
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums ${
                    opt.delta.strandedPax < 0
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <span>Stranded Pax:</span>
                  <span className="font-bold">
                    {opt.before.strandedPax} → {opt.after.strandedPax}
                  </span>
                  {opt.delta.strandedPax < 0 && (
                    <span className="text-[10px] text-emerald-700 font-bold">
                      ({opt.delta.strandedPax})
                    </span>
                  )}
                </div>

                {/* Delayed Flights Delta */}
                <div
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums ${
                    opt.delta.delayedFlights < 0
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <span>Delayed:</span>
                  <span className="font-bold">
                    {opt.before.delayedFlights} → {opt.after.delayedFlights}
                  </span>
                </div>

                {/* Total Delay Delta */}
                <div
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold tabular-nums ${
                    opt.delta.totalDelayMin < 0
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <span>Total Delay:</span>
                  <span className="font-bold">
                    {opt.before.totalDelayMin}m → {opt.after.totalDelayMin}m
                  </span>
                </div>

                {/* Crew Violations */}
                <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold tabular-nums text-slate-700">
                  <span>Crew Overruns:</span>
                  <span className="font-bold">
                    {opt.after.crewViolations}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
