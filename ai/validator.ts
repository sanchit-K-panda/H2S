/**
 * Strict Number Validator for Domino Sky AI Dispatcher.
 * Guarantees zero number drift: verifies that every single number/time in the AI text
 * is explicitly grounded in the engine's deterministic FACTS payload.
 */

import type { FactsPayload } from "./prompt";

export interface ValidatedAiResponse {
  recommendedActionId: string;
  headline: string;
  explanation: string;
}

export interface ValidationResult {
  valid: boolean;
  data?: ValidatedAiResponse;
  errors: string[];
  disallowedTokens: string[];
}

/**
 * Strips HTML tags and unsafe characters from text to prevent XSS.
 */
export function sanitizePlainText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"]/g, (char) => {
      switch (char) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "'":
          return "&#39;";
        case '"':
          return "&quot;";
        default:
          return char;
      }
    })
    .trim();
}

/**
 * Removes entity IDs (flights, aircraft tails, connections, crews, action strings)
 * so their numeric digits are not treated as numbers.
 */
export function maskEntityIds(text: string): string {
  return text
    .replace(/spare:[A-Z0-9_-]+:[A-Z0-9_-]+/gi, " [ACTION_ID] ")
    .replace(/cancel:[A-Z0-9_-]+/gi, " [ACTION_ID] ")
    .replace(/VT-DS\d{2}/gi, " [TAIL_ID] ")
    .replace(/DS\d{4}/gi, " [FLIGHT_ID] ")
    .replace(/CX\d+/gi, " [CONN_ID] ")
    .replace(/CR\d+/gi, " [CREW_ID] ");
}

/**
 * Recursively collects all allowed numeric values and time strings from the FACTS object.
 */
export function extractAllowedTokensFromFacts(facts: FactsPayload): Set<string> {
  const allowed = new Set<string>();

  function walk(val: unknown) {
    if (val === null || val === undefined) return;
    if (typeof val === "number") {
      const s = String(val);
      allowed.add(s);
      if (val < 0) {
        allowed.add(String(Math.abs(val)));
      }
    } else if (typeof val === "string") {
      // If it matches HH:MM time format
      if (/^\d{1,2}:\d{2}$/.test(val)) {
        allowed.add(val);
        // Also add the hour and minute parts without colon if isolated
        const [h, m] = val.split(":");
        allowed.add(String(parseInt(h, 10)));
        allowed.add(String(parseInt(m, 10)));
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        allowed.add(val);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) walk(item);
    } else if (typeof val === "object") {
      for (const v of Object.values(val as Record<string, unknown>)) {
        walk(v);
      }
    }
  }

  walk(facts);

  // Common ranks if options exist
  if (facts.options && facts.options.length > 0) {
    allowed.add("1");
    allowed.add("2");
    allowed.add("3");
  }

  return allowed;
}

/**
 * Extracts all numeric tokens and time patterns from text (after masking entity IDs).
 */
export function extractNumbersAndTimes(text: string): string[] {
  const masked = maskEntityIds(text);
  const tokens: string[] = [];

  // Match times like 08:00, 10:00
  const timeRegex = /\b\d{1,2}:\d{2}\b/g;
  let match: RegExpExecArray | null;
  while ((match = timeRegex.exec(masked)) !== null) {
    tokens.push(match[0]);
  }

  // Match isolated numbers (integers or decimals)
  // Remove matched times first so their numbers aren't duplicated as separate tokens
  const withoutTimes = masked.replace(timeRegex, " ");
  const numberRegex = /\b\d+(?:\.\d+)?\b/g;
  while ((match = numberRegex.exec(withoutTimes)) !== null) {
    tokens.push(match[0]);
  }

  return tokens;
}

/**
 * Validates raw AI output against facts and schema.
 */
export function validateAiResponse(
  rawText: string,
  facts: FactsPayload
): ValidationResult {
  const errors: string[] = [];
  const disallowedTokens: string[] = [];

  if (!rawText || typeof rawText !== "string") {
    return {
      valid: false,
      errors: ["Response is empty or not a string"],
      disallowedTokens: [],
    };
  }

  // 1. Strip markdown code fences if present
  let cleanedText = rawText.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON output: ${(err as Error).message}`],
      disallowedTokens: [],
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      valid: false,
      errors: ["Parsed JSON is not an object"],
      disallowedTokens: [],
    };
  }

  const obj = parsed as Record<string, unknown>;

  // 3. Schema validation
  if (
    typeof obj.recommendedActionId !== "string" ||
    !obj.recommendedActionId.trim()
  ) {
    errors.push("Missing or invalid 'recommendedActionId'");
  }
  if (typeof obj.headline !== "string" || !obj.headline.trim()) {
    errors.push("Missing or invalid 'headline'");
  }
  if (typeof obj.explanation !== "string" || !obj.explanation.trim()) {
    errors.push("Missing or invalid 'explanation'");
  }

  if (errors.length > 0) {
    return { valid: false, errors, disallowedTokens };
  }

  const recommendedActionId = obj.recommendedActionId as string;
  const headline = sanitizePlainText(obj.headline as string);
  const explanation = sanitizePlainText(obj.explanation as string);

  // 4. Verify recommendedActionId is one of the valid options in FACTS
  const validActionIds = new Set(facts.options.map((o) => o.id));
  if (!validActionIds.has(recommendedActionId)) {
    errors.push(
      `recommendedActionId "${recommendedActionId}" not found in FACTS.options`
    );
  }

  // 5. Number and time validation against FACTS allowed set
  const allowedSet = extractAllowedTokensFromFacts(facts);
  const textToCheck = `${headline} ${explanation}`;
  const extractedTokens = extractNumbersAndTimes(textToCheck);

  for (const token of extractedTokens) {
    if (!allowedSet.has(token)) {
      disallowedTokens.push(token);
    }
  }

  if (disallowedTokens.length > 0) {
    errors.push(
      `Disallowed or hallucinated numeric tokens detected: [${disallowedTokens.join(
        ", "
      )}]`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, disallowedTokens };
  }

  return {
    valid: true,
    data: {
      recommendedActionId,
      headline,
      explanation,
    },
    errors: [],
    disallowedTokens: [],
  };
}
