// features/search/types.ts
// Minimal type definitions for UI components (functionality removed for v4)

export interface FilterState {
  verified?: boolean;
  unverified?: boolean;
  from?: string;
  to?: string;
  mention?: string;
  list?: string;
  excludeUsers?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  dateRangeType?: string;
  lastXValue?: string | number;
  lastXUnit?: string;
  customRangeStart?: Date;
  customRangeEnd?: Date;
  mediaPresence?: "any" | "media" | "no_media";
  periscope?: boolean;
  nativeVideo?: boolean;
  consumerVideo?: boolean;
  proVideo?: boolean;
  vine?: boolean;
  videos?: boolean;
  images?: boolean;
  twitterImages?: boolean;
  spaces?: boolean;
  links?: boolean;
  mentions?: boolean;
  news?: boolean;
  hashtags?: boolean;
  hideSensitiveContent?: boolean;
  engagement?: {
    minLikes?: number;
    minRetweets?: number;
    minReplies?: number;
  };
  engagementType?: string;
  minLikes?: string | number;
  maxLikes?: string | number;
  minReplies?: string | number;
  maxReplies?: string | number;
  minRetweets?: string | number;
  maxRetweets?: string | number;
  url?: string;
  language?: string;
}
