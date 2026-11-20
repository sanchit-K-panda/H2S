import { describe, it, expect } from "vitest";
import { loadNetworkData } from "@/engine/network";

describe("Network Data Integrity & Schema Tests", () => {
  const network = loadNetworkData();

  it("loads exactly 16 airports with valid coordinates and tiers", () => {
    expect(network.airports).toHaveLength(16);
    for (const ap of network.airports) {
      expect(ap.id).toMatch(/^[A-Z]{3}$/);
      expect(ap.lat).toBeGreaterThan(5);
      expect(ap.lat).toBeLessThan(40);
      expect(ap.lng).toBeGreaterThan(65);
      expect(ap.lng).toBeLessThan(100);
      expect(["mega_hub", "regional_hub", "spoke"]).toContain(ap.tier);
      expect(ap.capacity_per_hour).toBeGreaterThan(0);
    }
  });

  it("loads exactly 70 scheduled flights across 16 primary aircraft tails", () => {
    expect(network.flights).toHaveLength(70);
    const tails = new Set(network.flights.map((f) => f.tail_id));
    expect(tails.size).toBe(16);

    for (const f of network.flights) {
      expect(f.flight_id).toMatch(/^DS\d{4}$/);
      expect(f.pax).toBeGreaterThan(0);
      expect(f.leg_order).toBeGreaterThanOrEqual(1);
      expect(f.block_minutes).toBeGreaterThan(0);
    }
  });

  it("loads 2 spare aircraft stationed at key hubs", () => {
    expect(network.spare_aircraft).toHaveLength(2);
    const blrSpare = network.spare_aircraft.find((s) => s.base === "BLR");
    const delSpare = network.spare_aircraft.find((s) => s.base === "DEL");

    expect(blrSpare).toBeDefined();
    expect(blrSpare?.tail_id).toBe("VT-DS17");
    expect(delSpare).toBeDefined();
    expect(delSpare?.tail_id).toBe("VT-DS18");
  });

  it("loads 21 connecting passenger itineraries with valid minimum connection times", () => {
    expect(network.connections).toHaveLength(21);
    for (const conn of network.connections) {
      expect(conn.passengers).toBeGreaterThan(0);
      expect(conn.min_connect_minutes).toBeGreaterThanOrEqual(40);
      // Origin flight and destination flight must exist in network
      const fromFlight = network.flights.find((f) => f.flight_id === conn.from_flight);
      const toFlight = network.flights.find((f) => f.flight_id === conn.to_flight);
      expect(fromFlight).toBeDefined();
      expect(toFlight).toBeDefined();
    }
  });

  it("loads 16 crew rosters with max legal duty hour limit of 600 min", () => {
    expect(network.crews).toHaveLength(16);
    for (const c of network.crews) {
      expect(c.max_duty_mins).toBe(600);
      expect(c.flight_ids.length).toBeGreaterThan(0);
    }
  });
});
