// features/search/lib/schemas.ts
// Minimal schemas for UI components (functionality removed for v4)

import { z } from "zod";

export const sortSchema = z.object({
  sortBy: z.enum([
    "newest_first",
    "oldest_first",
    "most_viewed_first",
    "least_viewed_first",
    "most_liked_first",
    "least_liked_first",
    "most_replied_first",
    "least_replied_first",
    "most_retweeted_first",
    "least_retweeted_first",
    "most_quoted_first",
    "least_quoted_first",
    "most_bookmarked_first",
    "least_bookmarked_first",
    "verified_first",
    "unverified_first",
  ]),
});

export type SortFormData = z.infer<typeof sortSchema>;
export type SortOption = SortFormData["sortBy"];

export const filterSchema = z.object({
  verified: z.boolean().optional(),
  unverified: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  mention: z.string().optional(),
  list: z.string().optional(),
  excludeUsers: z.array(z.string()).optional(),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
  dateRangeType: z.string().optional(),
  lastXValue: z.union([z.string(), z.number()]).optional(),
  lastXUnit: z.string().optional(),
  customRangeStart: z.date().optional(),
  customRangeEnd: z.date().optional(),
  mediaPresence: z.enum(["any", "media", "no_media"]).optional(),
  periscope: z.boolean().optional(),
  nativeVideo: z.boolean().optional(),
  consumerVideo: z.boolean().optional(),
  proVideo: z.boolean().optional(),
  vine: z.boolean().optional(),
  videos: z.boolean().optional(),
  images: z.boolean().optional(),
  twitterImages: z.boolean().optional(),
  spaces: z.boolean().optional(),
  links: z.boolean().optional(),
  mentions: z.boolean().optional(),
  news: z.boolean().optional(),
  hashtags: z.boolean().optional(),
  hideSensitiveContent: z.boolean().optional(),
  engagement: z
    .object({
      minLikes: z.number().optional(),
      minRetweets: z.number().optional(),
      minReplies: z.number().optional(),
    })
    .optional(),
  engagementType: z.string().optional(),
  minLikes: z.union([z.string(), z.number()]).optional(),
  maxLikes: z.union([z.string(), z.number()]).optional(),
  minReplies: z.union([z.string(), z.number()]).optional(),
  maxReplies: z.union([z.string(), z.number()]).optional(),
  minRetweets: z.union([z.string(), z.number()]).optional(),
  maxRetweets: z.union([z.string(), z.number()]).optional(),
  url: z.string().optional(),
  language: z.string().optional(),
});

export type FilterFormData = z.infer<typeof filterSchema>;
