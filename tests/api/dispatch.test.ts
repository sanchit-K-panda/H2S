import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dispatch/route";

describe("POST /api/dispatch Integration Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles valid closure request and returns verified template fallback response", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closure: {
          airport: "BOM",
          start: 480,
          end: 600,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.facts).toBeDefined();
    expect(body.facts.closure.airport).toBe("BOM");
    expect(body.facts.closure.startTime).toBe("08:00");
    expect(body.facts.closure.endTime).toBe("10:00");
    expect(body.facts.before.delayedFlights).toBe(17);
    expect(body.facts.before.strandedPax).toBe(115);
    expect(body.ai).toBeDefined();
    expect(body.ai.recommendedActionId).toBe("spare:DS0502:VT-DS17");
  });

  it("handles valid airport + start + duration parameters", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        airport: "DEL",
        start: 660,
        duration: 120,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.facts.closure.airport).toBe("DEL");
    expect(body.facts.closure.startTime).toBe("11:00");
    expect(body.facts.closure.endTime).toBe("13:00");
  });

  it("returns 400 for malformed JSON request body", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json-content",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 for missing mandatory parameters", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        airport: "BOM",
        // missing start and end/duration
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid request parameters");
  });

  it("returns 400 for unknown airport code", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closure: {
          airport: "ZZZ",
          start: 480,
          end: 600,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Unknown airport ID");
  });

  it("returns 400 when start is not strictly before end", async () => {
    const req = new Request("http://localhost:3000/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closure: {
          airport: "BOM",
          start: 600,
          end: 480,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("strictly before");
  });
});
