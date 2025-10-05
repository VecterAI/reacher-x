// features/search/types.ts
import type { SortOption } from "./lib/schemas";
export interface FilterState {
  // Users
  verified?: boolean;
  unverified?: boolean;
  from?: string;
  to?: string;
  mention?: string;
  list?: string;

  // Date
  dateRange?:
    | "all_time"
    | "last_1_hour"
    | "last_24_hours"
    | "last_7_days"
    | "last_30_days"
    | "last_365_days"
    | "last_x"
    | "custom_range";
  lastXValue?: string;
  lastXUnit?: "minutes" | "hours" | "days";
  customRangeStart?: Date;
  customRangeEnd?: Date;

  // Content
  url?: string;
  language?: string; // "all" means no language filter
  excludeUsers?: string[]; // lowercase screen_names without leading @

  // Media
  mediaPresence?: "any" | "with_media" | "without_media";
  images?: boolean;
  twitterImages?: boolean;
  videos?: boolean;
  periscope?: boolean;
  nativeVideo?: boolean;
  consumerVideo?: boolean;
  proVideo?: boolean;
  vine?: boolean;
  spaces?: boolean;
  links?: boolean;
  mentions?: boolean;
  news?: boolean;
  hashtags?: boolean;
  hideSensitiveContent?: boolean;

  // Engagement
  engagement?: "any" | "with_engagement" | "without_engagement";
  minLikes?: string;
  maxLikes?: string;
  minReplies?: string;
  maxReplies?: string;
  minRetweets?: string;
  maxRetweets?: string;
}

// Add this to your existing types file
export interface SortState {
  sortBy: SortOption;
}
