/**
 * Provider interface for pluggable LLM integrations in Domino Sky.
 * Server-side only; supports Gemini (default), Anthropic, and 'none' (deterministic template).
 */

export interface LlmProvider {
  /**
   * Generates a completion given a system instruction and user prompt.
   * Must reject or throw if the request exceeds the 10-second timeout.
   */
  complete(system: string, user: string): Promise<string>;
}

export interface ProviderConfig {
  provider: "gemini" | "anthropic" | "none";
  apiKey?: string;
  model?: string;
}

export function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER?.toLowerCase() || "none") as
    | "gemini"
    | "anthropic"
    | "none";
  const apiKey =
    provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : undefined;
  const model = process.env.LLM_MODEL;

  return {
    provider: apiKey ? provider : "none",
    apiKey,
    model,
  };
}
