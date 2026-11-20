"use client";

import React, { useState } from "react";
import type { FactsPayload } from "@/ai/prompt";

interface AiResponseData {
  recommendedActionId: string;
  headline: string;
  explanation: string;
}

interface AiPanelProps {
  aiData?: AiResponseData;
  verified?: boolean;
  source?: "llm" | "template";
  facts?: FactsPayload;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  onApplyRecommended?: (actionId: string) => void;
}

export function AiPanel({
  aiData,
  verified = false,
  source = "template",
  facts,
  isLoading = false,
  error,
  onRetry,
  onApplyRecommended,
}: AiPanelProps) {
  const [showFacts, setShowFacts] = useState(false);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="rounded-xl border border-sky-200 bg-sky-50/40 p-5 shadow-sm animate-pulse"
      >
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-sky-200" />
          <div className="h-5 w-24 rounded-full bg-sky-200" />
        </div>
        <div className="mt-4 h-5 w-3/4 rounded bg-sky-200" />
        <div className="mt-2 space-y-2">
          <div className="h-3.5 w-full rounded bg-sky-100" />
          <div className="h-3.5 w-5/6 rounded bg-sky-100" />
          <div className="h-3.5 w-2/3 rounded bg-sky-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-rose-900">AI Dispatcher Notice</h2>
          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            Error
          </span>
        </div>
        <p className="mt-2 text-xs text-rose-800">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry AI Recommendation
          </button>
        )}
      </div>
    );
  }

  if (!aiData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
        <h2 className="text-sm font-semibold text-slate-900">AI Recovery Dispatcher</h2>
        <p className="mt-1 text-xs text-slate-500">
          Run the simulation to generate an AI operational briefing with mathematically verified numbers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Badge Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">AI Dispatch Briefing</h2>
          {/* Source Tag */}
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
              source === "llm"
                ? "bg-sky-100 text-sky-800 ring-1 ring-sky-300"
                : "bg-slate-100 text-slate-700 ring-1 ring-slate-300"
            }`}
          >
            Source: {source === "llm" ? "Gemini 2.5 Flash" : "Deterministic Engine"}
          </span>
        </div>

        {/* Numbers Verified Badge */}
        {verified && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30"
            title="Guaranteed zero hallucination: Every number in this briefing matches the engine simulation exactly."
          >
            <svg
              className="h-3.5 w-3.5 text-emerald-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>Numbers Verified</span>
          </div>
        )}
      </div>

      {/* Headline & Explanation */}
      <div className="mt-3">
        <h3 className="text-sm font-bold text-slate-900">
          {aiData.headline}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-700">
          {aiData.explanation}
        </p>
      </div>

      {/* Recommended Action CTA */}
      {aiData.recommendedActionId && aiData.recommendedActionId !== "none" && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-sky-50/70 p-3 border border-sky-100">
          <div>
            <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider">
              Recommended Intervention
            </span>
            <div className="text-xs font-mono font-bold text-slate-900">
              {aiData.recommendedActionId}
            </div>
          </div>
          {onApplyRecommended && (
            <button
              type="button"
              onClick={() => onApplyRecommended(aiData.recommendedActionId)}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Apply Recommended
            </button>
          )}
        </div>
      )}

      {/* "Show Facts" Expandable Disclosure */}
      {facts && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowFacts(!showFacts)}
            aria-expanded={showFacts}
            className="flex w-full items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span>Audit Trail: Allowed Engine Facts JSON</span>
            <span className="font-mono text-slate-400">{showFacts ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {showFacts && (
            <div className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-200">
              <pre>{JSON.stringify(facts, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
