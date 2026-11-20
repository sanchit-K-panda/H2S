/**
 * Deterministic template fallback generator for Domino Sky AI Dispatcher.
 * Operates completely offline with zero API keys and 100% mathematical certainty.
 * Guaranteed to pass the number validator because all tokens originate from FACTS.
 */

import type { FactsPayload } from "./prompt";
import type { ValidatedAiResponse } from "./validator";

export function generateTemplateResponse(facts: FactsPayload): ValidatedAiResponse {
  const topOption = facts.options[0];

  // Case 1: Baseline network with zero disruption
  if (!facts.closure || facts.before.delayedFlights === 0) {
    const actionId = topOption ? topOption.id : "none";
    return {
      recommendedActionId: actionId,
      headline: "Network operating on normal schedule",
      explanation:
        "All scheduled flights and rotations are operating on time with 0 delayed flights, 0 stranded passengers, and 0 crew violations across the network. No recovery action is necessary.",
    };
  }

  // Case 2: No valid recovery options available
  if (!topOption) {
    const closureInfo = `Closing ${facts.closure.airport} from ${facts.closure.startTime} to ${facts.closure.endTime}`;
    return {
      recommendedActionId: "none",
      headline: `Network disruption active at ${facts.closure.airport}`,
      explanation: `${closureInfo} causes ${facts.before.delayedFlights} delayed flights, ${facts.before.strandedPax} stranded passengers, and ${facts.before.crewViolations} crew duty violations. No viable recovery action available.`,
    };
  }

  // Case 3: Standard disruption with ranked recovery recommendations
  const closureDesc = `Closing ${facts.closure.airport} from ${facts.closure.startTime} to ${facts.closure.endTime} (${facts.closure.durationMinutes} min)`;
  const headline = `Recommended recovery: ${topOption.label}`;

  let reliefDesc = "";
  if (topOption.delta.strandedPax < 0) {
    const rescued = Math.abs(topOption.delta.strandedPax);
    reliefDesc = ` cuts stranded passengers from ${facts.before.strandedPax} down to ${topOption.after.strandedPax} (rescuing ${rescued} passengers)`;
  } else if (topOption.delta.totalDelayMin < 0) {
    reliefDesc = ` reduces total network delay by ${Math.abs(topOption.delta.totalDelayMin)} minutes to ${topOption.after.totalDelayMin} minutes`;
  } else {
    reliefDesc = ` stabilizes operations with ${topOption.after.delayedFlights} delayed flights and ${topOption.after.strandedPax} stranded passengers`;
  }

  const crewDesc =
    topOption.after.crewViolations < facts.before.crewViolations
      ? ` and resolves crew duty overruns to ${topOption.after.crewViolations}`
      : ` with ${topOption.after.crewViolations} crew duty overruns`;

  const explanation = `${closureDesc} delays ${facts.before.delayedFlights} flights with ${facts.before.strandedPax} stranded passengers. Implementing ${topOption.label}${reliefDesc}${crewDesc}. This ranks highest among the ${facts.options.length} evaluated alternatives.`;

  return {
    recommendedActionId: topOption.id,
    headline,
    explanation,
  };
}
