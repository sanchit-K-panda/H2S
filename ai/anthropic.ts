/**
 * Anthropic Claude LLM Provider adapter using native fetch.
 * Server-side only; zero external SDK dependencies.
 */

import type { LlmProvider } from "./provider";

export class AnthropicProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = "claude-3-5-haiku-20241022") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(system: string, user: string): Promise<string> {
    const url = "https://api.anthropic.com/v1/messages";

    const payload = {
      model: this.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0.1,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Anthropic API HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;

      if (!text) {
        throw new Error("Empty completion returned from Anthropic API");
      }

      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
