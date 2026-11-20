import { describe, it, expect } from "vitest";
import { parseTimeToMinutes, formatMinutesToTime, isValidTimeInterval } from "@/engine/time";

describe("Time Conversion Utilities", () => {
  it("parses valid HH:MM strings to minutes from midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("01:00")).toBe(60);
    expect(parseTimeToMinutes("08:15")).toBe(495);
    expect(parseTimeToMinutes("12:30")).toBe(750);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("formats minutes from midnight to 24h zero-padded HH:MM strings", () => {
    expect(formatMinutesToTime(0)).toBe("00:00");
    expect(formatMinutesToTime(60)).toBe("01:00");
    expect(formatMinutesToTime(495)).toBe("08:15");
    expect(formatMinutesToTime(750)).toBe("12:30");
    expect(formatMinutesToTime(1439)).toBe("23:59");
    expect(formatMinutesToTime(1440)).toBe("24:00");
  });

  it("throws or handles negative and malformed time inputs safely", () => {
    expect(() => parseTimeToMinutes("")).toThrow(/Invalid time string/);
    expect(() => parseTimeToMinutes("invalid")).toThrow(/Invalid time format/);
    expect(() => parseTimeToMinutes("12")).toThrow(/Invalid time format/);
    expect(() => parseTimeToMinutes("25:00")).toThrow(/Out of range time values/);
    expect(() => parseTimeToMinutes("12:60")).toThrow(/Out of range time values/);
    expect(() => formatMinutesToTime(-5)).toThrow(/Invalid minute value/);
  });

  it("validates time intervals correctly", () => {
    expect(isValidTimeInterval(480, 600)).toBe(true);
    expect(isValidTimeInterval(600, 480)).toBe(false);
    expect(isValidTimeInterval(-10, 100)).toBe(false);
  });
});
