"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import rawNetworkData from "@/data/flight_network.json";
import {
  simulate,
  generateRecoveryOptions,
  parseTimeToMinutes,
  formatMinutesToTime,
} from "@/engine";
import type {
  NetworkData,
  Closure,
  RecoveryOption,
  SimResult,
} from "@/engine/types";
import type { FactsPayload } from "@/ai/prompt";
import { ScenarioPanel } from "@/components/ScenarioPanel";
import { KpiStrip } from "@/components/KpiStrip";
import { GanttTimeline } from "@/components/GanttTimeline";
import { FlightsTable } from "@/components/FlightsTable";
import { NetworkMap, type MapFlight } from "@/components/NetworkMap";
import { AerospaceLogo } from "@/components/AerospaceLogo";
import { RecoveryTab } from "@/components/RecoveryTab";
import { FlightTab } from "@/components/FlightTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CloudRain,
  SlidersHorizontal,
  Activity,
  Layers,
  Map as MapIcon,
  Table as TableIcon,
  X,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const network = rawNetworkData as unknown as NetworkData;

  // Disruption parameters state (defaults to primary BOM 08:00–10:00 benchmark)
  const [selectedAirport, setSelectedAirport] = useState("BOM");
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(120);

  // Active view canvas tab: "timeline" | "map" | "table"
  const [activeCanvasTab, setActiveCanvasTab] = useState<"timeline" | "map" | "table">("timeline");

  // Right column tab: "recovery" | "flight"
  const [activeRightTab, setActiveRightTab] = useState<"recovery" | "flight">("recovery");

  // Selection states
  const [selectedFlightId, setSelectedFlightId] = useState<string>("DS0502");
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null);

  // Mobile / drawer state
  const [mobileTab, setMobileTab] = useState<"scenario" | "impact" | "dispatcher">("impact");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

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

  // Live Operations Clock (IST + UTC Zulu)
  const [clockTime, setClockTime] = useState<{ ist: string; utc: string }>({
    ist: "--:--:--",
    utc: "--:--:--",
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const ist = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      });
      const utc = now.toLocaleTimeString("en-GB", {
        timeZone: "UTC",
        hour12: false,
      });
      setClockTime({ ist, utc });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

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
    return generateRecoveryOptions(network, activeClosure, 4);
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
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setAiData(data.ai);
      setAiSource(data.source);
      setAiVerified(data.verified);
      setAiFacts(data.facts);
      if (data.ai?.recommendedActionId) {
        setSelectedRecoveryOptionId(data.ai.recommendedActionId);
      }
    } catch {
      // Safe fallback handled gracefully
    } finally {
      setIsAiLoading(false);
    }
  }, [activeClosure]);

  // Live recompute: debounce AI dispatch calls by 200ms when closure changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runAiDispatch();
    }, 200);
    return () => clearTimeout(timer);
  }, [runAiDispatch]);

  // Reset handler
  const handleReset = () => {
    setSelectedAirport("BOM");
    setStartTime("08:00");
    setDuration(120);
    setIsRecoveryApplied(false);
    setSelectedFlightId("DS0502");
    toast("Scenario reset to benchmark", {
      description: "Mumbai (BOM) closed 08:00–10:00 IST",
    });
  };

  // Keyboard shortcuts (B, 1, 2, 3, ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "b" || e.key === "B") {
        if (activeRecoveryOption) {
          setIsRecoveryApplied((prev) => !prev);
          toast(
            isRecoveryApplied
              ? "Showing Before (Baseline Disruption)"
              : "Showing After (Recovery Applied)"
          );
        }
      } else if (e.key === "1") {
        setActiveCanvasTab("timeline");
      } else if (e.key === "2") {
        setActiveCanvasTab("map");
      } else if (e.key === "3") {
        setActiveCanvasTab("table");
      } else if (e.key === "?") {
        setShowHelpDialog((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRecoveryOption, isRecoveryApplied]);

  // Flight diagnostics details
  const selectedFlightResult = selectedFlightId
    ? currentSimResult.flights[selectedFlightId]
    : undefined;
  const rawSelectedFlight = selectedFlightId
    ? network.flights.find((f) => f.flight_id === selectedFlightId)
    : undefined;

  const selectedCrew = useMemo(() => {
    if (!selectedFlightId) return undefined;
    const crewInfo = network.crews.find((c) =>
      c.flight_ids.includes(selectedFlightId)
    );
    if (!crewInfo) return undefined;
    return currentSimResult.crews.find((cr) => cr.crewId === crewInfo.crew_id);
  }, [selectedFlightId, network.crews, currentSimResult.crews]);

  // Map flight routes transformed to section 5 contract
  const mapFlights: MapFlight[] = useMemo(() => {
    return network.flights.map((rf) => {
      const sim = currentSimResult.flights[rf.flight_id];
      const isCancelled = sim?.status === "cancelled";
      const isSpare = sim ? sim.tail !== rf.tail_id : false;
      const delayMin = sim?.arrDelay ?? 0;

      let band: MapFlight["band"] = "ok";
      if (isCancelled) band = "cancelled";
      else if (isSpare) band = "spare";
      else if (delayMin > 60) band = "severe";
      else if (delayMin > 0) band = "minor";

      return {
        id: rf.flight_id,
        origin: rf.origin,
        destination: rf.destination,
        pax: rf.pax,
        band,
        delayMin,
        depMin: sim?.actualDep ?? sim?.schedDep ?? parseTimeToMinutes(rf.dep),
        arrMin: sim?.actualArr ?? sim?.schedArr ?? parseTimeToMinutes(rf.arr),
        label: isCancelled
          ? "Cancelled"
          : delayMin > 0
          ? `+${delayMin}m delay`
          : "On time",
      };
    });
  }, [network.flights, currentSimResult.flights]);

  const handleSelectFlight = (fid: string) => {
    setSelectedFlightId(fid);
    setActiveRightTab("flight");
    setDrawerOpen(true);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-skybg text-skytext font-sans">
        {/* Skip to Main Content Link - WCAG 2.4.1 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-skyaccent focus:px-4 focus:py-2 focus:text-white focus:font-bold focus:shadow-card focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-skyaccent"
        >
          Skip to main content
        </a>

        {/* 1. TOP BAR (56px Slate/Navy) */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0F172A] px-4 text-white sm:px-6 shadow-subtle">
          <div className="flex items-center gap-3">
            <AerospaceLogo className="h-8 w-8" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold text-white tracking-normal font-sans">
                  Domino Sky
                </h1>
                <span className="hidden sm:inline-flex items-center rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                  Operations console
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Operations control center · 16 airports · 70 flights · 16 aircraft
              </p>
            </div>
          </div>

          {/* Top Bar Right: Real-time clocks, Scenario Status Chip & Shortcuts */}
          <div className="flex items-center gap-2.5">
            {/* Live Dual Clocks (IST / UTC ZULU) */}
            <div className="hidden xl:flex items-center gap-3 rounded border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 font-mono text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-400">IST</span>
                <span className="text-white font-medium tabular-nums">{clockTime.ist}</span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-slate-400">UTC</span>
                <span className="text-white font-medium tabular-nums">{clockTime.utc}Z</span>
              </div>
            </div>

            {/* Scenario Status Chip */}
            <div className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-200">
              <CloudRain className="h-3.5 w-3.5 text-amber-400" />
              <span>
                {selectedAirport} closed {startTime}–{formatMinutesToTime(activeClosure.end)}
              </span>
            </div>

            {/* Help Shortcuts Dialog Trigger */}
            <button
              type="button"
              onClick={() => setShowHelpDialog(true)}
              className="rounded p-1 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-skyaccent"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* Mobile / Tablet Drawer Trigger */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden flex items-center gap-1.5 rounded-control bg-skyaccent px-3 py-1 text-xs font-medium text-white shadow-subtle"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Recovery</span>
            </button>
          </div>
        </header>

        {/* 2. THREE-COLUMN APP SHELL (viewport-height, independent scroll) */}
        <div
          id="main-content"
          className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]"
        >
          {/* COLUMN 1: SCENARIO PANEL (300px on desktop; visible if mobileTab === 'scenario' on mobile) */}
          <aside
            className={`w-[300px] shrink-0 overflow-y-auto p-4 border-r border-skyborder bg-surface ${
              mobileTab === "scenario" ? "block w-full lg:w-[300px]" : "hidden lg:block"
            }`}
          >
            <ScenarioPanel
              airports={network.airports}
              selectedAirport={selectedAirport}
              startTime={startTime}
              duration={duration}
              onAirportChange={setSelectedAirport}
              onStartTimeChange={setStartTime}
              onDurationChange={setDuration}
              onReset={handleReset}
            />
          </aside>

          {/* COLUMN 2: IMPACT CANVAS (fluid flex-1; visible if mobileTab === 'impact' on mobile) */}
          <main
            className={`flex flex-1 flex-col overflow-y-auto p-4 sm:p-5 space-y-4 ${
              mobileTab === "impact" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* KPI Strip */}
            <KpiStrip
              currentKpis={currentSimResult.kpis}
              delta={activeRecoveryOption ? activeRecoveryOption.delta : undefined}
              isRecoveryApplied={isRecoveryApplied}
            />

            {/* Canvas Toolbar: View Tabs + Before/After Toggle */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-card border border-skyborder bg-white p-2 shadow-subtle">
              {/* View Switcher Tabs */}
              <Tabs
                value={activeCanvasTab}
                onValueChange={(val) => setActiveCanvasTab(val as typeof activeCanvasTab)}
              >
                <TabsList className="bg-slate-100 p-0.5">
                  <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                    <Layers className="h-3.5 w-3.5 text-skymuted" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="map" className="gap-1.5 text-xs">
                    <MapIcon className="h-3.5 w-3.5 text-skymuted" />
                    Network map
                  </TabsTrigger>
                  <TabsTrigger value="table" className="gap-1.5 text-xs">
                    <TableIcon className="h-3.5 w-3.5 text-skymuted" />
                    Flights table
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Before / After Fix Toggle */}
              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={isRecoveryApplied ? "after" : "before"}
                  onValueChange={(val) => {
                    if (val === "after") setIsRecoveryApplied(true);
                    if (val === "before") setIsRecoveryApplied(false);
                  }}
                >
                  <ToggleGroupItem value="before" aria-label="Show before recovery baseline">
                    Before
                  </ToggleGroupItem>
                  <ToggleGroupItem value="after" aria-label="Show after recovery fix">
                    After fix
                  </ToggleGroupItem>
                </ToggleGroup>

                {/* Applied action indicator chip with undo */}
                {isRecoveryApplied && activeRecoveryOption && (
                  <Badge variant="ontime" className="gap-1 font-mono text-[11px]">
                    <span>{activeRecoveryOption.action.type === "spare" ? "Spare swap applied" : "Flight cancel applied"}</span>
                    <button
                      type="button"
                      onClick={() => setIsRecoveryApplied(false)}
                      className="rounded hover:bg-emerald-200/50 p-0.5"
                      title="Undo recovery"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>

            {/* Canvas Content Panels */}
            {activeCanvasTab === "timeline" && (
              <GanttTimeline
                flightResults={currentSimResult.flights}
                baselineResults={baselineSimResult.flights}
                rawFlights={network.flights}
                closure={activeClosure}
                selectedFlightId={selectedFlightId}
                isRecoveryApplied={isRecoveryApplied}
                onSelectFlight={handleSelectFlight}
              />
            )}

            {activeCanvasTab === "map" && (
              <NetworkMap
                airports={network.airports}
                flights={mapFlights}
                closedAirport={selectedAirport}
                closureLabel={`${startTime}–${formatMinutesToTime(activeClosure.end)}`}
                closureStart={activeClosure.start}
                closureEnd={activeClosure.end}
                selectedFlightId={selectedFlightId}
                hoveredFlightId={hoveredFlightId}
                onSelectFlight={handleSelectFlight}
                onHoverFlight={setHoveredFlightId}
              />
            )}

            {activeCanvasTab === "table" && (
              <FlightsTable
                flightResults={currentSimResult.flights}
                rawFlights={network.flights}
                selectedFlightId={selectedFlightId}
                onSelectFlight={handleSelectFlight}
              />
            )}
          </main>

          {/* COLUMN 3: RECOVERY & FLIGHT DETAIL PANEL (390px on desktop; visible if mobileTab === 'dispatcher' on mobile) */}
          <aside
            className={`w-[390px] shrink-0 overflow-y-auto border-l border-skyborder bg-surface p-4 ${
              mobileTab === "dispatcher" ? "block w-full lg:hidden" : "hidden xl:block"
            }`}
          >
            <Tabs
              value={activeRightTab}
              onValueChange={(val) => setActiveRightTab(val as typeof activeRightTab)}
            >
              <TabsList className="w-full bg-slate-100 p-0.5 mb-3.5">
                <TabsTrigger value="recovery" className="flex-1 text-xs font-bold">
                  Recovery Dispatcher
                </TabsTrigger>
                <TabsTrigger value="flight" className="flex-1 text-xs font-bold">
                  Flight Diagnostics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recovery" className="mt-0">
                <RecoveryTab
                  options={recoveryOptions}
                  selectedOptionId={selectedRecoveryOptionId}
                  isRecoveryApplied={isRecoveryApplied}
                  aiData={aiData || undefined}
                  aiVerified={aiVerified}
                  aiSource={aiSource}
                  aiFacts={aiFacts}
                  isAiLoading={isAiLoading}
                  onSelectOption={(id) => {
                    setSelectedRecoveryOptionId(id);
                    const opt = recoveryOptions.find((o) => o.id === id);
                    if (opt) setSelectedFlightId(opt.action.flightId);
                  }}
                  onToggleApplyRecovery={() => setIsRecoveryApplied(!isRecoveryApplied)}
                />
              </TabsContent>

              <TabsContent value="flight" className="mt-0">
                <FlightTab
                  flightId={selectedFlightId}
                  flightResult={selectedFlightResult}
                  rawFlight={rawSelectedFlight}
                  connections={currentSimResult.connections}
                  crew={selectedCrew}
                  onSelectFlight={setSelectedFlightId}
                />
              </TabsContent>
            </Tabs>
          </aside>
        </div>

        {/* Bottom Navigation Bar for Mobile (< lg) */}
        <nav
          aria-label="Mobile view navigation"
          className="lg:hidden flex h-13 shrink-0 items-center justify-around border-t border-skyborder bg-white px-2 py-1 shadow-subtle z-40"
        >
          <button
            type="button"
            onClick={() => setMobileTab("scenario")}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-control px-4 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "scenario" ? "text-skyaccent font-bold" : "text-skymuted hover:text-navy"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Scenario</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("impact")}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-control px-4 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "impact" ? "text-skyaccent font-bold" : "text-skymuted hover:text-navy"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Impact</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("dispatcher")}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-control px-4 py-1 text-[11px] font-semibold transition-colors ${
              mobileTab === "dispatcher" ? "text-skyaccent font-bold" : "text-skymuted hover:text-navy"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Dispatcher</span>
          </button>
        </nav>

        {/* Slide-over Drawer for Tablet (1024px–1279px) & Mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 backdrop-blur-xs xl:hidden">
            <div className="w-full max-w-md h-full bg-surface p-4 overflow-y-auto shadow-card animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-skyborder/60 pb-3 mb-3">
                <span className="text-sm font-bold text-navy">
                  Operations Dispatcher
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-control p-1 text-skymuted hover:text-navy"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Tabs
                value={activeRightTab}
                onValueChange={(val) => setActiveRightTab(val as typeof activeRightTab)}
              >
                <TabsList className="w-full bg-slate-100 p-0.5 mb-3.5">
                  <TabsTrigger value="recovery" className="flex-1 text-xs font-bold">
                    Recovery Dispatcher
                  </TabsTrigger>
                  <TabsTrigger value="flight" className="flex-1 text-xs font-bold">
                    Flight Diagnostics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="recovery">
                  <RecoveryTab
                    options={recoveryOptions}
                    selectedOptionId={selectedRecoveryOptionId}
                    isRecoveryApplied={isRecoveryApplied}
                    aiData={aiData || undefined}
                    aiVerified={aiVerified}
                    aiSource={aiSource}
                    aiFacts={aiFacts}
                    isAiLoading={isAiLoading}
                    onSelectOption={(id) => {
                      setSelectedRecoveryOptionId(id);
                      const opt = recoveryOptions.find((o) => o.id === id);
                      if (opt) setSelectedFlightId(opt.action.flightId);
                    }}
                    onToggleApplyRecovery={() => setIsRecoveryApplied(!isRecoveryApplied)}
                  />
                </TabsContent>

                <TabsContent value="flight">
                  <FlightTab
                    flightId={selectedFlightId}
                    flightResult={selectedFlightResult}
                    rawFlight={rawSelectedFlight}
                    connections={currentSimResult.connections}
                    crew={selectedCrew}
                    onSelectFlight={setSelectedFlightId}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                Power navigation shortcuts for rapid airline dispatch operations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-skyborder/60 pb-1.5">
                <span className="text-skymuted">Toggle Before / After recovery</span>
                <kbd className="rounded-control border border-skyborder bg-slate-100 px-2 py-0.5 font-mono font-bold text-navy">
                  B
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-skyborder/60 pb-1.5">
                <span className="text-skymuted">Switch to Rotation Timeline</span>
                <kbd className="rounded-control border border-skyborder bg-slate-100 px-2 py-0.5 font-mono font-bold text-navy">
                  1
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-skyborder/60 pb-1.5">
                <span className="text-skymuted">Switch to Network Map</span>
                <kbd className="rounded-control border border-skyborder bg-slate-100 px-2 py-0.5 font-mono font-bold text-navy">
                  2
                </kbd>
              </div>
              <div className="flex items-center justify-between border-b border-skyborder/60 pb-1.5">
                <span className="text-skymuted">Switch to Flights Table</span>
                <kbd className="rounded-control border border-skyborder bg-slate-100 px-2 py-0.5 font-mono font-bold text-navy">
                  3
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-skymuted">Open shortcuts reference</span>
                <kbd className="rounded-control border border-skyborder bg-slate-100 px-2 py-0.5 font-mono font-bold text-navy">
                  ?
                </kbd>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
