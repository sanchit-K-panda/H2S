/**
 * POST /api/dispatch
 * AI Dispatcher API endpoint for Domino Sky.
 * Validates request with Zod, executes deterministic simulation + recovery ranking,
 * invokes guarded LLM provider with 10s timeout, verifies numbers against facts,
 * and falls back to deterministic template on drift or timeout.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  loadNetworkData,
  simulate,
  generateRecoveryOptions,
  validateClosure,
} from "@/engine";
import type { Closure } from "@/engine/types";
import {
  getProviderConfig,
  GeminiProvider,
  AnthropicProvider,
  SYSTEM_PROMPT,
  buildFactsPayload,
  buildUserPrompt,
  buildRetryPrompt,
  validateAiResponse,
  generateTemplateResponse,
} from "@/ai";

const DispatchRequestSchema = z
  .object({
    airport: z.string().min(2).max(4).optional(),
    start: z.number().int().min(0).optional(),
    end: z.number().int().min(0).optional(),
    duration: z.number().int().min(15).max(360).optional(),
    closure: z
      .object({
        airport: z.string().min(2).max(4),
        start: z.number().int().min(0),
        end: z.number().int().min(0),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.closure) return true;
      if (data.airport && data.start !== undefined && (data.end !== undefined || data.duration !== undefined)) {
        return true;
      }
      return false;
    },
    {
      message:
        "Either 'closure' object or 'airport', 'start', and ('end' or 'duration') must be provided",
    }
  );

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const parseResult = DispatchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { airport, start, end, duration, closure: explicitClosure } = parseResult.data;

    let closure: Closure;
    if (explicitClosure) {
      closure = explicitClosure;
    } else {
      const computedEnd = end !== undefined ? end : (start as number) + (duration as number);
      closure = {
        airport: airport as string,
        start: start as number,
        end: computedEnd,
      };
    }

    const network = loadNetworkData();

    // Validate closure against network airports and bounds
    try {
      validateClosure(closure, network);
    } catch (valErr) {
      return NextResponse.json(
        { error: (valErr as Error).message },
        { status: 400 }
      );
    }

    // Step 1: Run deterministic engine simulation + recovery
    const simResult = simulate(network, closure);
    const recoveryOptions = generateRecoveryOptions(network, closure, 3);
    const facts = buildFactsPayload(simResult, recoveryOptions);

    // Step 2: Determine provider configuration
    const config = getProviderConfig();

    if (config.provider === "none" || !config.apiKey) {
      // Offline / template mode
      const templateData = generateTemplateResponse(facts);
      return NextResponse.json({
        facts,
        ai: templateData,
        verified: true,
        source: "template",
      });
    }

    // Initialize appropriate provider
    const provider =
      config.provider === "gemini"
        ? new GeminiProvider(config.apiKey, config.model || "gemini-2.5-flash")
        : new AnthropicProvider(config.apiKey, config.model || "claude-3-5-haiku-20241022");

    const userPrompt = buildUserPrompt(facts);

    try {
      // First LLM call
      const firstResponse = await provider.complete(SYSTEM_PROMPT, userPrompt);
      const validation1 = validateAiResponse(firstResponse, facts);

      if (validation1.valid && validation1.data) {
        return NextResponse.json({
          facts,
          ai: validation1.data,
          verified: true,
          source: "llm",
        });
      }

      // Validation failed -> retry once with specific feedback
      const retryPrompt = buildRetryPrompt(facts, validation1.disallowedTokens);
      const retryResponse = await provider.complete(SYSTEM_PROMPT, retryPrompt);
      const validation2 = validateAiResponse(retryResponse, facts);

      if (validation2.valid && validation2.data) {
        return NextResponse.json({
          facts,
          ai: validation2.data,
          verified: true,
          source: "llm",
        });
      }

      // Retry failed validation -> fallback to deterministic template
      const fallback = generateTemplateResponse(facts);
      return NextResponse.json({
        facts,
        ai: fallback,
        verified: true,
        source: "template",
        fallbackReason: "retry_validation_failed",
      });
    } catch (providerError) {
      // LLM call timed out or failed -> fallback to deterministic template
      const fallback = generateTemplateResponse(facts);
      return NextResponse.json({
        facts,
        ai: fallback,
        verified: true,
        source: "template",
        fallbackReason: (providerError as Error).message,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
