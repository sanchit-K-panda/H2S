"use client";

import React from "react";
import type { Kpis, RecoveryDelta } from "@/engine/types";

interface KpiCardsProps {
  currentKpis: Kpis;
  delta?: RecoveryDelta;
  isRecoveryApplied?: boolean;
}

interface CardConfig {
  id: string;
  title: string;
  value: number;
  deltaValue?: number;
  unit?: string;
  statusType: "danger" | "warning" | "neutral" | "info";
  description: string;
}

export function KpiCards({
  currentKpis,
  delta,
  isRecoveryApplied = false,
}: KpiCardsProps) {
  const cards: CardConfig[] = [
    {
      id: "delayed-flights",
      title: "Delayed Flights",
      value: currentKpis.delayedFlights,
      deltaValue: delta?.delayedFlights,
      statusType: currentKpis.delayedFlights > 0 ? "warning" : "neutral",
      description: "Operated legs with arrival delay > 0 min",
    },
    {
      id: "stranded-passengers",
      title: "Stranded Passengers",
      value: currentKpis.strandedPax,
      deltaValue: delta?.strandedPax,
      statusType: currentKpis.strandedPax > 0 ? "danger" : "neutral",
      description: "Cancelled flight pax + broken connections",
    },
    {
      id: "total-delay-minutes",
      title: "Total Delay",
      value: currentKpis.totalDelayMin,
      deltaValue: delta?.totalDelayMin,
      unit: "min",
      statusType: currentKpis.totalDelayMin > 0 ? "warning" : "neutral",
      description: "Cumulative positive arrival delay across network",
    },
    {
      id: "crew-violations",
      title: "Crew Violations",
      value: currentKpis.crewViolations,
      deltaValue: delta?.crewViolations,
      statusType: currentKpis.crewViolations > 0 ? "danger" : "neutral",
      description: "Rotations exceeding 600 min duty limit",
    },
    {
      id: "cancelled-flights",
      title: "Cancelled Flights",
      value: currentKpis.cancelledFlights,
      deltaValue: delta?.cancelledFlights,
      statusType: currentKpis.cancelledFlights > 0 ? "info" : "neutral",
      description: "Flights cancelled by recovery intervention",
    },
  ];

  return (
    <section
      aria-label="Simulation key performance metrics"
      aria-live="polite"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {cards.map((card) => {
        const hasDelta = isRecoveryApplied && card.deltaValue !== undefined && card.deltaValue !== 0;
        const deltaIsImprovement = (card.deltaValue ?? 0) < 0;

        return (
          <div
            key={card.id}
            className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
              card.value > 0
                ? "border-slate-200 bg-white shadow-xs"
                : "border-slate-100 bg-white/70 text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{card.title}</span>
              {card.statusType === "danger" && card.value > 0 && (
                <span className="inline-flex h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
              )}
              {card.statusType === "warning" && card.value > 0 && (
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                {card.value.toLocaleString()}
              </span>
              {card.unit && (
                <span className="text-xs font-medium text-slate-500">
                  {card.unit}
                </span>
              )}
            </div>

            {/* Delta indicator when recovery applied */}
            {hasDelta ? (
              <div
                className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  deltaIsImprovement
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                    : "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"
                }`}
              >
                <span>
                  {card.deltaValue! > 0 ? `+${card.deltaValue}` : card.deltaValue}
                </span>
                <span className="text-[10px] font-medium">
                  {deltaIsImprovement ? "improved" : "increased"}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-slate-500 line-clamp-1">
                {card.description}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
