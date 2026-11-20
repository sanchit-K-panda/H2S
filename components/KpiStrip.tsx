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
  label: string;
  value: number;
  deltaVal?: number;
  unit?: string;
  severityBorder: string;
  icon: React.ReactNode;
  tooltipText: string;
}

export function KpiStrip({
  currentKpis,
  delta,
  isRecoveryApplied,
}: KpiStripProps) {
  // Simple animated display value for count-up
  const [animatedKpis, setAnimatedKpis] = useState<Kpis>(currentKpis);

  useEffect(() => {
    // Respect prefers-reduced-motion
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

    const start = { ...animatedKpis };
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
      label: "Delayed flights",
      value: animatedKpis.delayedFlights,
      deltaVal: delta?.delayedFlights,
      severityBorder: currentKpis.delayedFlights > 0 ? "border-t-status-minor" : "border-t-transparent",
      icon: <Clock className="h-4 w-4 text-status-minor" />,
      tooltipText: "Flights arriving with delay greater than zero minutes across network chains",
    },
    {
      id: "stranded-pax",
      label: "Stranded passengers",
      value: animatedKpis.strandedPax,
      deltaVal: delta?.strandedPax,
      severityBorder: currentKpis.strandedPax > 0 ? "border-t-status-severe" : "border-t-transparent",
      icon: <Users className="h-4 w-4 text-status-severe" />,
      tooltipText: "Passengers on cancelled flights plus connecting itineraries broken by upstream delays (deduplicated)",
    },
    {
      id: "total-delay",
      label: "Total delay",
      value: animatedKpis.totalDelayMin,
      deltaVal: delta?.totalDelayMin,
      unit: "m",
      severityBorder: currentKpis.totalDelayMin > 0 ? "border-t-amber-500" : "border-t-transparent",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      tooltipText: "Cumulative sum of arrival delays in minutes across all operated flights",
    },
    {
      id: "crew-violations",
      label: "Crew violations",
      value: animatedKpis.crewViolations,
      deltaVal: delta?.crewViolations,
      severityBorder: currentKpis.crewViolations > 0 ? "border-t-status-severe" : "border-t-transparent",
      icon: <UserX className="h-4 w-4 text-status-severe" />,
      tooltipText: "Flight crews whose duty period exceeds the 600-minute legal maximum limit",
    },
    {
      id: "cancelled-flights",
      label: "Cancelled flights",
      value: animatedKpis.cancelledFlights,
      deltaVal: delta?.cancelledFlights,
      severityBorder: currentKpis.cancelledFlights > 0 ? "border-t-status-cancelled" : "border-t-transparent",
      icon: <XCircle className="h-4 w-4 text-skymuted" />,
      tooltipText: "Flight legs actively cancelled as an operational recovery intervention",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-label="Simulation impact summary metrics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
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
              className={`flex flex-col justify-between rounded-card border border-skyborder bg-surface p-3.5 shadow-subtle border-t-[3px] ${card.severityBorder} transition-all`}
            >
              {/* Header: Icon + Label + Tooltip Trigger */}
              <div className="flex items-center justify-between text-xs text-skymuted font-medium">
                <div className="flex items-center gap-1.5 min-w-0">
                  {card.icon}
                  <span className="truncate text-skytext font-semibold">
                    {card.label}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Definition for ${card.label}`}
                      className="rounded-full p-0.5 text-skymuted hover:text-navy focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent"
                    >
                      <HelpCircle className="h-3 w-3 opacity-60" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {card.tooltipText}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Metric Value + Delta Chip */}
              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-[28px] font-semibold tracking-tight tabular-nums text-navy font-sans leading-none">
                    {card.value.toLocaleString()}
                  </span>
                  {card.unit && (
                    <span className="text-xs font-semibold text-skymuted">
                      {card.unit}
                    </span>
                  )}
                </div>

                {showDelta && (
                  <div
                    className={`inline-flex items-center gap-0.5 rounded-chip px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                      isImprovement
                        ? "bg-status-ontime-bg text-status-ontime"
                        : "bg-status-severe-bg text-status-severe"
                    }`}
                    title={`Net change vs baseline: ${card.deltaVal! > 0 ? `+${card.deltaVal}` : card.deltaVal}`}
                  >
                    {isImprovement ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    )}
                    <span>{Math.abs(card.deltaVal!)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </TooltipProvider>
  );
}
