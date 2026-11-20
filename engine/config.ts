/**
 * Configuration constants for the Domino Sky deterministic simulation engine.
 * Single source of truth for operational rules, default thresholds, and constraints.
 */

export const ENGINE_CONFIG = {
  /** Default minimum turnaround in minutes when not overridden per flight */
  DEFAULT_MIN_TURNAROUND_MINUTES: 30,

  /** Maximum legal crew duty duration in minutes before a violation is flagged */
  MAX_CREW_DUTY_MINUTES: 600,

  /** Default passenger capacity per aircraft */
  SEATS_PER_AIRCRAFT: 180,

  /** Allowed airport closure duration constraints in minutes */
  CLOSURE: {
    MIN_DURATION_MINUTES: 15,
    MAX_DURATION_MINUTES: 360,
    STEP_MINUTES: 15,
    MIN_MINUTE_OF_DAY: 0,
    MAX_MINUTE_OF_DAY: 1439,
  },

  /** Delay categorization bands for visualization and analysis */
  DELAY_BANDS: {
    ON_TIME: 0,
    MINOR: 60,
    MODERATE: 180,
  },
} as const;
