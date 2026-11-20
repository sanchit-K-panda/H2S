/**
 * Time utility functions for integer-minute arithmetic.
 * All internal engine times are represented as integer minutes since 00:00 IST.
 */

/**
 * Parses an "HH:MM" 24-hour time string into integer minutes since 00:00.
 * Example: "08:30" -> 510
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") {
    throw new Error(`Invalid time string: ${timeStr}`);
  }
  const parts = timeStr.trim().split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid time format, expected HH:MM: ${timeStr}`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes >= 60 ||
    (hours === 24 && minutes > 0)
  ) {
    throw new Error(`Out of range time values: ${timeStr}`);
  }
  return hours * 60 + minutes;
}

/**
 * Formats integer minutes since 00:00 into a zero-padded "HH:MM" 24-hour time string.
 * Example: 510 -> "08:30"
 */
export function formatMinutesToTime(minutes: number): string {
  if (Number.isNaN(minutes) || minutes < 0) {
    throw new Error(`Invalid minute value: ${minutes}`);
  }
  const normalizedHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(normalizedHours)}:${pad(mins)}`;
}

/**
 * Validates that start is strictly before end within the valid day range.
 */
export function isValidTimeInterval(start: number, end: number): boolean {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start < end;
}
