"use client";

import React, { useState } from "react";
import type { RecoveryOption } from "@/engine/types";
import type { FactsPayload } from "@/ai/prompt";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
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
  CheckCircle2,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
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
        <Card className="border-skyaccent/40 bg-surface shadow-card ring-1 ring-skyaccent/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-4 border-b border-skyborder/60">
            <div className="flex items-center justify-between">
              <Badge variant="accent" className="font-bold tracking-wider text-[10px]">
                RECOMMENDED ACTION
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => copyActionId(heroOption.id)}
                    className="flex items-center gap-1 font-mono text-[10px] text-skymuted hover:text-skytext"
                  >
                    <span>{heroOption.id}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy internal action ID</TooltipContent>
              </Tooltip>
            </div>

            <h3 className="mt-2 text-sm font-bold text-navy leading-snug">
              {heroOption.label}
            </h3>
            <p className="mt-0.5 text-[11px] text-skymuted">
              {heroOption.action.type === "spare"
                ? `Swap standby spare ${heroOption.action.spareTail} to sever downstream rotation delay.`
                : `Cancel flight ${heroOption.action.flightId} to prevent broader multi-airport cascade.`}
            </p>
          </div>

          <CardContent className="p-4 space-y-3.5">
            {/* 4-Row Metric Table */}
            <div className="divide-y divide-skyborder/60 rounded-control border border-skyborder bg-slate-50/50 text-xs">
              {/* Stranded Pax */}
              <div className="flex items-center justify-between p-2">
                <span className="text-skymuted font-medium">Stranded Pax</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="text-skymuted line-through">
                    {heroOption.before.strandedPax}
                  </span>
                  <ArrowRight className="h-3 w-3 text-skymuted" />
                  <span className="text-navy">{heroOption.after.strandedPax}</span>
                  <Badge variant="ontime" className="h-4.5 px-1 font-mono font-bold text-[10px]">
                    ▼{Math.abs(heroOption.delta.strandedPax)}
                  </Badge>
                </div>
              </div>

              {/* Delayed Flights */}
              <div className="flex items-center justify-between p-2">
                <span className="text-skymuted font-medium">Delayed Flights</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="text-skymuted line-through">
                    {heroOption.before.delayedFlights}
                  </span>
                  <ArrowRight className="h-3 w-3 text-skymuted" />
                  <span className="text-navy">{heroOption.after.delayedFlights}</span>
                  {heroOption.delta.delayedFlights < 0 && (
                    <Badge variant="ontime" className="h-4.5 px-1 font-mono font-bold text-[10px]">
                      ▼{Math.abs(heroOption.delta.delayedFlights)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Total Delay */}
              <div className="flex items-center justify-between p-2">
                <span className="text-skymuted font-medium">Total Delay</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="text-skymuted line-through">
                    {heroOption.before.totalDelayMin}m
                  </span>
                  <ArrowRight className="h-3 w-3 text-skymuted" />
                  <span className="text-navy">{heroOption.after.totalDelayMin}m</span>
                  {heroOption.delta.totalDelayMin < 0 && (
                    <Badge variant="ontime" className="h-4.5 px-1 font-mono font-bold text-[10px]">
                      ▼{Math.abs(heroOption.delta.totalDelayMin)}m
                    </Badge>
                  )}
                </div>
              </div>

              {/* Crew Overruns */}
              <div className="flex items-center justify-between p-2">
                <span className="text-skymuted font-medium">Crew Violations</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-navy">
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
                className="w-full gap-1.5 border-emerald-300 bg-emerald-50 text-status-ontime hover:bg-emerald-100 font-bold"
              >
                <Check className="h-4 w-4" />
                ✓ Applied · Click to Undo
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApply(heroOption)}
                className="w-full gap-1.5 font-bold"
              >
                Apply Recommendation
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 2. AI OPERATIONAL DISPATCH BRIEFING */}
        <Card className="border-skyborder bg-surface shadow-subtle p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-skyborder/60 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-skyaccent" />
              <h4 className="text-xs font-bold text-navy">AI Dispatch Briefing</h4>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Verified Badge */}
              {aiVerified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="ontime" className="cursor-help gap-1 text-[10px]">
                      <ShieldCheck className="h-3 w-3 text-status-ontime" />
                      Numbers verified
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
              <h5 className="text-xs font-bold text-navy leading-snug">
                {aiData.headline}
              </h5>
              <p
                className={`text-xs text-skymuted leading-relaxed ${
                  !explanationExpanded ? "line-clamp-3" : ""
                }`}
              >
                {aiData.explanation}
              </p>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setExplanationExpanded(!explanationExpanded)}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-skyaccent hover:underline"
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
                  className="text-[11px] font-semibold text-skymuted hover:text-navy underline"
                >
                  Audit facts JSON
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-skymuted">
              AI briefing is compiling for the current disruption scenario.
            </p>
          )}
        </Card>

        {/* 3. ALTERNATIVE RECOVERY CANDIDATES */}
        {otherOptions.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-skymuted">
              Other Evaluated Alternatives ({otherOptions.length})
            </span>
            <div className="space-y-2">
              {otherOptions.map((opt, i) => {
                const isThisApplied = isRecoveryApplied && activeOption.id === opt.id;

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center justify-between rounded-control border p-3 text-xs transition-colors ${
                      isThisApplied
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-skyborder bg-white hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy text-xs truncate">
                          {opt.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-skymuted">
                        <span>
                          Stranded: {opt.before.strandedPax} → {opt.after.strandedPax} (▼{Math.abs(opt.delta.strandedPax)})
                        </span>
                      </div>
                    </div>

                    <Button
                      variant={isThisApplied ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => (isThisApplied ? handleUndo() : handleApply(opt))}
                      className="h-7 text-xs font-semibold shrink-0"
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
              <DialogTitle>Deterministic Zero-Drift Audit Trail</DialogTitle>
              <DialogDescription>
                Every numeric token stated by the AI Dispatcher is validated against this exact engine facts payload. Any deviation triggers an immediate fallback to a deterministic template.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-auto rounded-control bg-navy p-3 font-mono text-[11px] text-slate-200">
              <pre>{JSON.stringify(aiFacts, null, 2)}</pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
