import type { DateRangePreset } from "./types";

export const DATE_RANGE_PRESETS = [
  "today",
  "1d",
  "7d",
  "30d",
  "custom",
] as const satisfies ReadonlyArray<DateRangePreset>;
