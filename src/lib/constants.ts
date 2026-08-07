export const APP_TIMEZONE = "Europe/Zurich";

/** How many working days ahead the scheduling engine searches for slots. */
export const SCHEDULING_LOOKAHEAD_DAYS = 14;

/** Max number of ranked slot options shown to a client. */
export const MAX_SLOT_OPTIONS = 5;
export const MIN_SLOT_OPTIONS_TARGET = 3;

/** Hard, non-configurable ceiling — mirrors the DB default but enforced in code too. */
export const HARD_RADIUS_CAP_MINUTES_DEFAULT = 90;

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
