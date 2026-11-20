/**
 * Gemini LLM Provider adapter using native fetch.
 * Server-side only; zero external SDK dependencies.
 */

import type { LlmProvider } from "./provider";

export class GeminiProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(system: string, user: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // low temperature for deterministic adherence
        responseMimeType: "application/json",
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini API HTTP ${response.status}: ${errorText.slice(0, 200)}`
        );
      }

      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("Empty completion returned from Gemini API");
      }

      return text;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
