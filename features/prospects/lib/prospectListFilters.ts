import { addDays, format, subDays, subHours } from "date-fns";

export type ProspectListDatePreset =
  | "all_time"
  | "today"
  | "1d"
  | "7d"
  | "30d"
  | "custom";

export type ProspectListProspectType = "both" | "individual" | "organization";

export type ProspectListPlatform = "all" | "twitter" | "linkedin";

export interface ProspectListCustomDateRange {
  from?: Date;
  to?: Date;
}

export interface ProspectListFilters {
  fitScoreRange: [number, number];
  datePreset: ProspectListDatePreset;
  customDateRange?: ProspectListCustomDateRange;
  prospectType: ProspectListProspectType;
  platform: ProspectListPlatform;
}

export interface ProspectListFilterArgs {
  fitScoreMin: number;
  fitScoreMax: number;
  platform?: "twitter" | "linkedin";
  prospectType?: "individual" | "organization";
  createdAfterMs?: number;
  createdBeforeMs?: number;
}

function cloneDate(date: Date | undefined): Date | undefined {
  return date ? new Date(date.getTime()) : undefined;
}

export function cloneProspectListFilters(
  filters: ProspectListFilters
): ProspectListFilters {
  return {
    fitScoreRange: [...filters.fitScoreRange] as [number, number],
    datePreset: filters.datePreset,
    customDateRange: filters.customDateRange
      ? {
          from: cloneDate(filters.customDateRange.from),
          to: cloneDate(filters.customDateRange.to),
        }
      : undefined,
    prospectType: filters.prospectType,
    platform: filters.platform,
  };
}

export function createDefaultProspectListFilters(
  fitScoreRange: [number, number]
): ProspectListFilters {
  return {
    fitScoreRange,
    datePreset: "all_time",
    customDateRange: undefined,
    prospectType: "both",
    platform: "all",
  };
}

function areDatesEqual(left?: Date, right?: Date): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.getTime() === right.getTime();
}

function hasEffectiveCustomDateRange(
  range: ProspectListCustomDateRange | undefined
): boolean {
  return Boolean(range?.from || range?.to);
}

export function areProspectListFiltersEqual(
  left: ProspectListFilters,
  right: ProspectListFilters
): boolean {
  return (
    left.fitScoreRange[0] === right.fitScoreRange[0] &&
    left.fitScoreRange[1] === right.fitScoreRange[1] &&
    left.datePreset === right.datePreset &&
    areDatesEqual(left.customDateRange?.from, right.customDateRange?.from) &&
    areDatesEqual(left.customDateRange?.to, right.customDateRange?.to) &&
    left.prospectType === right.prospectType &&
    left.platform === right.platform
  );
}

function isDateFilterActive(
  filters: ProspectListFilters,
  defaults: ProspectListFilters
): boolean {
  if (filters.datePreset === "all_time") {
    return defaults.datePreset !== "all_time";
  }

  if (filters.datePreset === "custom") {
    return hasEffectiveCustomDateRange(filters.customDateRange);
  }

  return filters.datePreset !== defaults.datePreset;
}

export function getProspectListActiveFilterCount(
  filters: ProspectListFilters,
  defaults: ProspectListFilters
): number {
  let count = 0;

  if (
    filters.fitScoreRange[0] !== defaults.fitScoreRange[0] ||
    filters.fitScoreRange[1] !== defaults.fitScoreRange[1]
  ) {
    count += 1;
  }

  if (isDateFilterActive(filters, defaults)) {
    count += 1;
  }

  if (filters.prospectType !== defaults.prospectType) {
    count += 1;
  }

  if (filters.platform !== defaults.platform) {
    count += 1;
  }

  return count;
}

function formatCompactDate(date: Date | undefined): string | null {
  if (!date) return null;
  return format(date, "yyyy-MM-dd");
}

function getDateSummary(filters: ProspectListFilters): string | null {
  switch (filters.datePreset) {
    case "all_time":
      return null;
    case "today":
      return "Today";
    case "1d":
      return "24 hours";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "custom": {
      const from = formatCompactDate(filters.customDateRange?.from);
      const to = formatCompactDate(filters.customDateRange?.to);
      if (from && to) return `${from}→${to}`;
      if (from) return `${from}→`;
      if (to) return `→${to}`;
      return null;
    }
    default:
      return null;
  }
}

export function getProspectListFilterSummaryTokens(
  filters: ProspectListFilters,
  defaults: ProspectListFilters
): string[] {
  const tokens: string[] = [];

  if (
    filters.fitScoreRange[0] !== defaults.fitScoreRange[0] ||
    filters.fitScoreRange[1] !== defaults.fitScoreRange[1]
  ) {
    tokens.push(`Fit ${filters.fitScoreRange[0]}-${filters.fitScoreRange[1]}`);
  }

  const dateSummary = getDateSummary(filters);
  if (dateSummary && isDateFilterActive(filters, defaults)) {
    tokens.push(dateSummary);
  }

  if (filters.prospectType === "individual") {
    tokens.push("Individuals");
  } else if (filters.prospectType === "organization") {
    tokens.push("Organizations");
  }

  if (filters.platform === "twitter") {
    tokens.push("X");
  } else if (filters.platform === "linkedin") {
    tokens.push("LinkedIn");
  }

  return tokens;
}

function getUtcDayStart(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function getProspectListFilterArgs(
  filters: ProspectListFilters,
  now: Date = new Date()
): ProspectListFilterArgs {
  const args: ProspectListFilterArgs = {
    fitScoreMin: filters.fitScoreRange[0],
    fitScoreMax: filters.fitScoreRange[1],
  };

  if (filters.platform !== "all") {
    args.platform = filters.platform;
  }

  if (filters.prospectType !== "both") {
    args.prospectType = filters.prospectType;
  }

  if (filters.datePreset === "today") {
    args.createdAfterMs = getUtcDayStart(now);
    args.createdBeforeMs = now.getTime();
  } else if (filters.datePreset === "1d") {
    args.createdAfterMs = subHours(now, 24).getTime();
    args.createdBeforeMs = now.getTime();
  } else if (filters.datePreset === "7d") {
    args.createdAfterMs = subDays(now, 7).getTime();
    args.createdBeforeMs = now.getTime();
  } else if (filters.datePreset === "30d") {
    args.createdAfterMs = subDays(now, 30).getTime();
    args.createdBeforeMs = now.getTime();
  } else if (filters.datePreset === "custom") {
    if (filters.customDateRange?.from) {
      args.createdAfterMs = new Date(
        filters.customDateRange.from.getFullYear(),
        filters.customDateRange.from.getMonth(),
        filters.customDateRange.from.getDate()
      ).getTime();
    }
    if (filters.customDateRange?.to) {
      args.createdBeforeMs = addDays(filters.customDateRange.to, 1).getTime();
    }
  }

  return args;
}
