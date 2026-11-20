"use client";

import React, { useState } from "react";
import type { RecoveryOption } from "@/engine/types";
import type { FactsPayload } from "@/ai/prompt";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  FileText,
  ArrowRight,
  ShieldCheck,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface RecoveryTabProps {
  options: RecoveryOption[];
  selectedOptionId?: string;
  isRecoveryApplied: boolean;
  aiData?: {
    recommendedActionId: string;
    headline: string;
    explanation: string;
  };
  aiVerified?: boolean;
  aiSource?: "llm" | "template";
  aiFacts?: FactsPayload;
  isAiLoading?: boolean;
  onSelectOption: (id: string) => void;
  onToggleApplyRecovery: () => void;
}

export function RecoveryTab({
  options,
  selectedOptionId,
  isRecoveryApplied,
  aiData,
  aiVerified = true,
  aiSource = "template",
  aiFacts,
  isAiLoading = false,
  onSelectOption,
  onToggleApplyRecovery,
}: RecoveryTabProps) {
  const [showFactsDialog, setShowFactsDialog] = useState(false);
  const [explanationExpanded, setExplanationExpanded] = useState(false);

  if (!options || options.length === 0) {
    return (
      <div className="p-6 text-center text-skymuted">
        No candidate recovery actions generated.
      </div>
    );
  }

  const heroOption = options[0];
  const otherOptions = options.slice(1, 4);

  const activeOption =
    options.find((o) => o.id === selectedOptionId) || heroOption;

  const handleApply = (option: RecoveryOption) => {
    onSelectOption(option.id);
    if (!isRecoveryApplied) {
      onToggleApplyRecovery();
    }
    toast.success("Recovery action applied", {
      description: `Stranded passengers reduced from ${option.before.strandedPax} → ${option.after.strandedPax} (▼${Math.abs(option.delta.strandedPax)})`,
    });
  };

  const handleUndo = () => {
    if (isRecoveryApplied) {
      onToggleApplyRecovery();
    }
    toast.info("Recovery action undone", {
      description: "Reverted back to baseline disruption state.",
    });
  };

  const copyActionId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast("Action ID copied to clipboard", { description: id });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        {/* 1. HERO RECOMMENDATION CARD */}
        <Card className="border border-slate-200 bg-surface shadow-subtle overflow-hidden">
          <div className="bg-slate-50/80 p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-medium text-[11px] text-slate-700 bg-white">
                Recommended action
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => copyActionId(heroOption.id)}
                    className="flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-slate-800"
                  >
                    <span>{heroOption.id}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy internal action ID</TooltipContent>
              </Tooltip>
            </div>

            <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
              {heroOption.label}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {heroOption.action.type === "spare"
                ? `Swap standby spare ${heroOption.action.spareTail} to sever downstream rotation delay.`
                : `Cancel flight ${heroOption.action.flightId} to prevent broader multi-airport cascade.`}
            </p>
          </div>

          <CardContent className="p-4 space-y-3.5">
            {/* 4-Row Metric Table */}
            <div className="divide-y divide-slate-100 rounded-control border border-slate-200 bg-slate-50/60 text-xs">
              {/* Stranded Pax */}
              <div className="flex items-center justify-between p-2">
                <span className="text-slate-600 font-medium">Stranded passengers</span>
                <div className="flex items-center gap-1.5 font-mono font-medium">
                  <span className="text-slate-400 line-through">
                    {heroOption.before.strandedPax}
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-900 font-semibold">{heroOption.after.strandedPax}</span>
                  <Badge variant="ontime" className="h-4.5 px-1 font-mono font-medium text-[10px]">
                    ▼{Math.abs(heroOption.delta.strandedPax)}
                  </Badge>
                </div>
              </div>

              {/* Delayed Flights */}
              <div className="flex items-center justify-between p-2">
                <span className="text-slate-600 font-medium">Delayed flights</span>
                <div className="flex items-center gap-1.5 font-mono font-medium">
                  <span className="text-slate-400 line-through">
                    {heroOption.before.delayedFlights}
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-900 font-semibold">{heroOption.after.delayedFlights}</span>
                  {heroOption.delta.delayedFlights < 0 && (
                    <Badge variant="ontime" className="h-4.5 px-1 font-mono font-medium text-[10px]">
                      ▼{Math.abs(heroOption.delta.delayedFlights)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Total Delay */}
              <div className="flex items-center justify-between p-2">
                <span className="text-slate-600 font-medium">Total delay</span>
                <div className="flex items-center gap-1.5 font-mono font-medium">
                  <span className="text-slate-400 line-through">
                    {heroOption.before.totalDelayMin}m
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-900 font-semibold">{heroOption.after.totalDelayMin}m</span>
                  {heroOption.delta.totalDelayMin < 0 && (
                    <Badge variant="ontime" className="h-4.5 px-1 font-mono font-medium text-[10px]">
                      ▼{Math.abs(heroOption.delta.totalDelayMin)}m
                    </Badge>
                  )}
                </div>
              </div>

              {/* Crew Overruns */}
              <div className="flex items-center justify-between p-2">
                <span className="text-slate-600 font-medium">Crew duty breaches</span>
                <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                  <span>{heroOption.after.crewViolations} over limit</span>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            {isRecoveryApplied && activeOption.id === heroOption.id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                className="w-full gap-1.5 border-emerald-300 bg-emerald-50 text-status-ontime hover:bg-emerald-100 font-medium"
              >
                <Check className="h-4 w-4" />
                Applied · Click to undo
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApply(heroOption)}
                className="w-full gap-1.5 font-medium"
              >
                Apply recommendation
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 2. OPERATIONAL DISPATCH BRIEFING */}
        <Card className="border border-slate-200 bg-surface shadow-subtle p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-semibold text-slate-900">Dispatch assessment</h4>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Verified Badge */}
              {aiVerified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="ontime" className="cursor-help gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3 text-status-ontime" />
                      Verified
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Deterministic zero-drift guardrail: All numbers in this narrative match engine calculations 1:1.
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Source Tag */}
              <Badge variant="secondary" className="font-mono text-[10px]">
                {aiSource === "llm" ? "Gemini 2.5 Flash" : "Template"}
              </Badge>
            </div>
          </div>

          {isAiLoading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          ) : aiData ? (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-900 leading-snug">
                {aiData.headline}
              </h5>
              <p
                className={`text-xs text-slate-600 leading-relaxed ${
                  !explanationExpanded ? "line-clamp-3" : ""
                }`}
              >
                {aiData.explanation}
              </p>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setExplanationExpanded(!explanationExpanded)}
                  className="flex items-center gap-0.5 text-[11px] font-medium text-skyaccent hover:underline"
                >
                  {explanationExpanded ? (
                    <>
                      Show less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Read full briefing <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowFactsDialog(true)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  Audit facts JSON
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Dispatch briefing is compiling for the current disruption scenario.
            </p>
          )}
        </Card>

        {/* 3. ALTERNATIVE RECOVERY CANDIDATES */}
        {otherOptions.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-medium text-slate-500">
              Alternative recovery options ({otherOptions.length})
            </span>
            <div className="space-y-2">
              {otherOptions.map((opt) => {
                const isThisApplied = isRecoveryApplied && activeOption.id === opt.id;

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between rounded-control border p-3 text-xs transition-colors ${
                      isThisApplied
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-slate-200 bg-white hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs truncate">
                          {opt.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                        <span>
                          Stranded: {opt.before.strandedPax} → {opt.after.strandedPax} (▼{Math.abs(opt.delta.strandedPax)})
                        </span>
                      </div>
                    </div>

                    <Button
                      variant={isThisApplied ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => (isThisApplied ? handleUndo() : handleApply(opt))}
                      className="h-7 text-xs font-medium shrink-0"
                    >
                      {isThisApplied ? "Active" : "Apply"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* How numbers are verified Dialog */}
        <Dialog open={showFactsDialog} onOpenChange={setShowFactsDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Engine facts payload</DialogTitle>
              <DialogDescription>
                Every numeric token stated in the dispatch assessment matches this engine facts payload.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-auto rounded-control bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
              <pre>{JSON.stringify(aiFacts, null, 2)}</pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
