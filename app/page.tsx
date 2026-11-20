"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import rawNetworkData from "@/data/flight_network.json";
import {
  simulate,
  generateRecoveryOptions,
  parseTimeToMinutes,
} from "@/engine";
import type {
  NetworkData,
  Closure,
  RecoveryOption,
  SimResult,
} from "@/engine/types";
import type { FactsPayload } from "@/ai/prompt";
import { ControlPanel } from "@/components/ControlPanel";
import { KpiCards } from "@/components/KpiCards";
import { DataTable } from "@/components/DataTable";
import { FlightDetail } from "@/components/FlightDetail";
import { RecoveryPanel } from "@/components/RecoveryPanel";
import { AiPanel } from "@/components/AiPanel";
import { GanttTimeline } from "@/components/GanttTimeline";
import { AirMap } from "@/components/AirMap";

export default function Home() {
  const network = rawNetworkData as unknown as NetworkData;

  // Disruption parameters state (defaults to primary BOM 08:00–10:00 benchmark)
  const [selectedAirport, setSelectedAirport] = useState("BOM");
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(120);

  // Active view tab in main view
  const [activeTab, setActiveTab] = useState<"map" | "timeline" | "table">("timeline");

  // Selection states
  const [selectedFlightId, setSelectedFlightId] = useState<string>("DS0502");
  const [selectedAirportId, setSelectedAirportId] = useState<string>("BOM");

  // Recovery application state
  const [selectedRecoveryOptionId, setSelectedRecoveryOptionId] = useState<string>("");
  const [isRecoveryApplied, setIsRecoveryApplied] = useState(false);

  // AI Dispatcher API state
  const [aiData, setAiData] = useState<{
    recommendedActionId: string;
    headline: string;
    explanation: string;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<"llm" | "template">("template");
  const [aiVerified, setAiVerified] = useState(true);
  const [aiFacts, setAiFacts] = useState<FactsPayload | undefined>(undefined);
  const [aiError, setAiError] = useState<string | undefined>(undefined);

  // Active closure object
  const activeClosure: Closure = useMemo(() => {
    const startMin = parseTimeToMinutes(startTime);
    return {
      airport: selectedAirport,
      start: startMin,
      end: startMin + duration,
    };
  }, [selectedAirport, startTime, duration]);

  // Baseline disruption simulation (BEFORE recovery)
  const baselineSimResult: SimResult = useMemo(() => {
    return simulate(network, activeClosure);
  }, [network, activeClosure]);

  // Evaluated recovery options
  const recoveryOptions: RecoveryOption[] = useMemo(() => {
    return generateRecoveryOptions(network, activeClosure, 3);
  }, [network, activeClosure]);

  // Select active recovery option
  const activeRecoveryOption = useMemo(() => {
    if (!recoveryOptions || recoveryOptions.length === 0) return null;
    return (
      recoveryOptions.find((o) => o.id === selectedRecoveryOptionId) ||
      recoveryOptions[0]
    );
  }, [recoveryOptions, selectedRecoveryOptionId]);

  // Current simulation result depending on Before/After toggle
  const currentSimResult: SimResult = useMemo(() => {
    if (isRecoveryApplied && activeRecoveryOption) {
      return simulate(network, activeClosure, [activeRecoveryOption.action]);
    }
    return baselineSimResult;
  }, [network, activeClosure, isRecoveryApplied, activeRecoveryOption, baselineSimResult]);

  // Fetch AI dispatch recommendation
  const runAiDispatch = useCallback(async () => {
    setIsAiLoading(true);
    setAiError(undefined);

    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airport: activeClosure.airport,
          start: activeClosure.start,
          end: activeClosure.end,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setAiData(data.ai);
      setAiSource(data.source);
      setAiVerified(data.verified);
      setAiFacts(data.facts);
      if (data.ai?.recommendedActionId) {
        setSelectedRecoveryOptionId(data.ai.recommendedActionId);
      }
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setIsAiLoading(false);
    }
  }, [activeClosure]);

  // Run AI dispatch automatically once on mount or when closure parameters are explicitly simulated
  useEffect(() => {
    runAiDispatch();
  }, [runAiDispatch]);

  const handleReset = () => {
    setSelectedAirport("BOM");
    setStartTime("08:00");
    setDuration(120);
    setIsRecoveryApplied(false);
    setSelectedFlightId("DS0502");
    setSelectedAirportId("BOM");
  };

  const selectedFlightResult = selectedFlightId
    ? currentSimResult.flights[selectedFlightId]
    : undefined;
  const rawSelectedFlight = selectedFlightId
    ? network.flights.find((f) => f.flight_id === selectedFlightId)
    : undefined;

  // Selected crew
  const selectedCrew = useMemo(() => {
    if (!selectedFlightId) return undefined;
    const crewInfo = network.crews.find((c) =>
      c.flight_ids.includes(selectedFlightId)
    );
    if (!crewInfo) return undefined;
    return currentSimResult.crews.find((cr) => cr.crewId === crewInfo.crew_id);
  }, [selectedFlightId, network.crews, currentSimResult.crews]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-white font-black text-lg shadow-xs">
              ✈
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Domino Sky
                </h1>
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-600/20">
                  Disruption Cascade &amp; Recovery Dispatcher
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Single-day network simulator (16 airports • 70 flights • 16 aircraft)
              </p>
            </div>
          </div>

          {/* Header Quick Stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Sim Status: Active</span>
            </div>
            <a
              href="#main-content"
              className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Results
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* KPI Summary Cards */}
        <div className="mb-6">
          <KpiCards
            currentKpis={currentSimResult.kpis}
            delta={activeRecoveryOption ? activeRecoveryOption.delta : undefined}
            isRecoveryApplied={isRecoveryApplied}
          />
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Disruption Controls & Recovery Action Panel */}
          <div className="space-y-6 lg:col-span-4">
            <ControlPanel
              airports={network.airports}
              selectedAirport={selectedAirport}
              startTime={startTime}
              duration={duration}
              onAirportChange={(ap) => {
                setSelectedAirport(ap);
                setSelectedAirportId(ap);
              }}
              onStartTimeChange={setStartTime}
              onDurationChange={setDuration}
              onRunSimulation={runAiDispatch}
              onReset={handleReset}
              isLoading={isAiLoading}
            />

            <RecoveryPanel
              options={recoveryOptions}
              selectedOptionId={selectedRecoveryOptionId}
              isRecoveryApplied={isRecoveryApplied}
              onSelectOption={(id) => {
                setSelectedRecoveryOptionId(id);
                // Also auto-select the affected flight to show detail
                const opt = recoveryOptions.find((o) => o.id === id);
                if (opt) setSelectedFlightId(opt.action.flightId);
              }}
              onToggleApplyRecovery={() => setIsRecoveryApplied(!isRecoveryApplied)}
            />

            <AiPanel
              aiData={aiData || undefined}
              verified={aiVerified}
              source={aiSource}
              facts={aiFacts}
              isLoading={isAiLoading}
              error={aiError}
              onRetry={runAiDispatch}
              onApplyRecommended={(recId) => {
                setSelectedRecoveryOptionId(recId);
                setIsRecoveryApplied(true);
              }}
            />
          </div>

          {/* Right Column: Visualization Tabs (Map / Timeline / Table) & Flight Diagnostics */}
          <div className="space-y-6 lg:col-span-8">
            {/* View Tab Selector */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => setActiveTab("timeline")}
                  className={`rounded-md px-3.5 py-1.5 transition-colors ${
                    activeTab === "timeline"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  Rotation Timeline (Gantt)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("map")}
                  className={`rounded-md px-3.5 py-1.5 transition-colors ${
                    activeTab === "map"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  Network Map (SVG)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("table")}
                  className={`rounded-md px-3.5 py-1.5 transition-colors ${
                    activeTab === "table"
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  Flights Table (Accessible)
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono hidden sm:block pr-2">
                Click any flight to diagnose
              </div>
            </div>

            {/* Tab Panels */}
            {activeTab === "timeline" && (
              <GanttTimeline
                flightResults={currentSimResult.flights}
                rawFlights={network.flights}
                closure={activeClosure}
                selectedFlightId={selectedFlightId}
                onSelectFlight={(fid) => setSelectedFlightId(fid)}
              />
            )}

            {activeTab === "map" && (
              <AirMap
                airports={network.airports}
                flightResults={currentSimResult.flights}
                rawFlights={network.flights}
                closure={activeClosure}
                selectedFlightId={selectedFlightId}
                selectedAirportId={selectedAirportId}
                onSelectFlight={(fid) => setSelectedFlightId(fid)}
                onSelectAirport={(apId) => {
                  setSelectedAirportId(apId);
                  setSelectedAirport(apId);
                }}
              />
            )}

            {activeTab === "table" && (
              <DataTable
                flightResults={currentSimResult.flights}
                rawFlights={network.flights}
                selectedFlightId={selectedFlightId}
                onSelectFlight={(fid) => setSelectedFlightId(fid)}
              />
            )}

            {/* Flight Diagnostics & Cause Chain Drawer */}
            <FlightDetail
              flightId={selectedFlightId}
              flightResult={selectedFlightResult}
              rawFlight={rawSelectedFlight}
              connections={currentSimResult.connections}
              crew={selectedCrew}
              onSelectRelatedFlight={(fid) => setSelectedFlightId(fid)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
