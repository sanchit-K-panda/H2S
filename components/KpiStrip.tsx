"use client";

import React, { useEffect, useState } from "react";
import type { Kpis, RecoveryDelta } from "@/engine/types";
import {
  Clock,
  Users,
  AlertTriangle,
  UserX,
  XCircle,
  HelpCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface KpiStripProps {
  currentKpis: Kpis;
  delta?: RecoveryDelta;
  isRecoveryApplied: boolean;
}

interface CardMeta {
  id: string;
  shortLabel: string;
  subLabel: string;
  value: number;
  deltaVal?: number;
  unit?: string;
  dotColor: string;
  icon: React.ReactNode;
  tooltipText: string;
}

export function KpiStrip({
  currentKpis,
  delta,
  isRecoveryApplied,
}: KpiStripProps) {
  // Animated display value for count-up
  const [animatedKpis, setAnimatedKpis] = useState<Kpis>(currentKpis);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setAnimatedKpis(currentKpis);
      return;
    }

    const duration = 250;
    const steps = 10;
    const stepDuration = duration / steps;
    let step = 0;

    const start = animatedKpis;
    const diff = {
      delayedFlights: currentKpis.delayedFlights - start.delayedFlights,
      cancelledFlights: currentKpis.cancelledFlights - start.cancelledFlights,
      totalDelayMin: currentKpis.totalDelayMin - start.totalDelayMin,
      strandedPax: currentKpis.strandedPax - start.strandedPax,
      crewViolations: currentKpis.crewViolations - start.crewViolations,
    };

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedKpis({
        delayedFlights: Math.round(start.delayedFlights + diff.delayedFlights * progress),
        cancelledFlights: Math.round(start.cancelledFlights + diff.cancelledFlights * progress),
        totalDelayMin: Math.round(start.totalDelayMin + diff.totalDelayMin * progress),
        strandedPax: Math.round(start.strandedPax + diff.strandedPax * progress),
        crewViolations: Math.round(start.crewViolations + diff.crewViolations * progress),
      });

      if (step >= steps) {
        clearInterval(interval);
        setAnimatedKpis(currentKpis);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [currentKpis]);

  const cards: CardMeta[] = [
    {
      id: "delayed-flights",
      shortLabel: "Delayed Flights",
      subLabel: "out of 70 operated",
      value: animatedKpis.delayedFlights,
      deltaVal: delta?.delayedFlights,
      dotColor: currentKpis.delayedFlights > 0 ? "bg-amber-500" : "bg-emerald-500",
      icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
      tooltipText: "Flights arriving with delay greater than zero minutes across network chains",
    },
    {
      id: "stranded-pax",
      shortLabel: "Stranded Pax",
      subLabel: "cancelled + missed conn",
      value: animatedKpis.strandedPax,
      deltaVal: delta?.strandedPax,
      dotColor: currentKpis.strandedPax > 0 ? "bg-rose-500" : "bg-emerald-500",
      icon: <Users className="h-3.5 w-3.5 text-rose-500" />,
      tooltipText: "Passengers on cancelled flights plus connecting itineraries broken by upstream delays (deduplicated)",
    },
    {
      id: "total-delay",
      shortLabel: "Total Delay",
      subLabel: `${Math.floor(animatedKpis.totalDelayMin / 60)}h ${animatedKpis.totalDelayMin % 60}m network loss`,
      value: animatedKpis.totalDelayMin,
      deltaVal: delta?.totalDelayMin,
      unit: "m",
      dotColor: currentKpis.totalDelayMin > 0 ? "bg-amber-500" : "bg-emerald-500",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
      tooltipText: "Cumulative sum of arrival delays in minutes across all operated flights",
    },
    {
      id: "crew-violations",
      shortLabel: "Crew Breaches",
      subLabel: "exceeded 600m FDTL",
      value: animatedKpis.crewViolations,
      deltaVal: delta?.crewViolations,
      dotColor: currentKpis.crewViolations > 0 ? "bg-rose-500" : "bg-emerald-500",
      icon: <UserX className="h-3.5 w-3.5 text-rose-500" />,
      tooltipText: "Flight crews whose duty period exceeds the 600-minute legal maximum limit",
    },
    {
      id: "cancelled-flights",
      shortLabel: "Cancellations",
      subLabel: "operational interventions",
      value: animatedKpis.cancelledFlights,
      deltaVal: delta?.cancelledFlights,
      dotColor: currentKpis.cancelledFlights > 0 ? "bg-slate-500" : "bg-emerald-500",
      icon: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
      tooltipText: "Flight legs actively cancelled as an operational recovery intervention",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-label="Simulation impact summary metrics"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {/* Visually hidden screen-reader live announcement */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Current simulation impact: {currentKpis.delayedFlights} delayed flights,{" "}
          {currentKpis.strandedPax} stranded passengers,{" "}
          {currentKpis.totalDelayMin} minutes total delay,{" "}
          {currentKpis.crewViolations} crew duty violations.
          {isRecoveryApplied && delta && (
            <span>
              Applied recovery reduced stranded passengers by {Math.abs(delta.strandedPax)}.
            </span>
          )}
        </div>

        {cards.map((card) => {
          const showDelta = isRecoveryApplied && card.deltaVal !== undefined && card.deltaVal !== 0;
          const isImprovement = (card.deltaVal ?? 0) < 0;

          return (
            <div
              key={card.id}
              className="group relative flex flex-col justify-between rounded-card border border-slate-200/90 bg-white p-3 shadow-xs hover:border-slate-300 transition-all hover:shadow-subtle"
            >
              {/* Header: Label + Tooltip Trigger (Never truncates) */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${card.dotColor}`} />
                  <span className="font-semibold text-slate-700 tracking-tight whitespace-nowrap">
                    {card.shortLabel}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Definition for ${card.shortLabel}`}
                      className="rounded-full p-0.5 text-slate-400 hover:text-navy focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent"
                    >
                      <HelpCircle className="h-3 w-3 opacity-70" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {card.tooltipText}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Metric Value + Delta Chip */}
              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-[26px] font-bold tracking-tight tabular-nums text-navy font-sans leading-none">
                    {card.value.toLocaleString()}
                  </span>
                  {card.unit && (
                    <span className="text-xs font-semibold text-slate-400">
                      {card.unit}
                    </span>
                  )}
                </div>

                {showDelta ? (
                  <div
                    className={`inline-flex items-center gap-0.5 rounded-chip px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      isImprovement
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                    title={`Net change vs baseline: ${card.deltaVal! > 0 ? `+${card.deltaVal}` : card.deltaVal}`}
                  >
                    {isImprovement ? (
                      <ArrowDown className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowUp className="h-2.5 w-2.5" />
                    )}
                    <span>{Math.abs(card.deltaVal!)}</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    {card.id === "delayed-flights" && "24% fleet"}
                    {card.id === "stranded-pax" && "pax"}
                    {card.id === "crew-violations" && "FDTL"}
                    {card.id === "cancelled-flights" && "legs"}
                  </span>
                )}
              </div>

              {/* Sub-label for rich context */}
              <div className="mt-1 text-[10px] text-slate-400 truncate">
                {card.subLabel}
              </div>
            </div>
          );
        })}
      </section>
    </TooltipProvider>
  );
}
