// features/search/lib/schemas.ts
import { z } from "zod";

export const filterSchema = z.object({
  // Users tab
  verified: z.boolean().default(true),
  unverified: z.boolean().default(true),
  from: z.string().default(""),
  to: z.string().default(""),
  mention: z.string().default(""),
  list: z.string().default(""),

  // Date tab
  dateRange: z
    .enum([
      "all_time",
      "last_1_hour",
      "last_24_hours",
      "last_7_days",
      "last_30_days",
      "last_365_days",
      "last_x",
      "custom_range",
    ])
    .default("all_time"),
  lastXValue: z.string().default(""),
  lastXUnit: z.enum(["minutes", "hours", "days"]).default("days"),
  customRangeStart: z.date().optional(),
  customRangeEnd: z.date().optional(),

  // Content tab
  url: z.string().default(""),
  language: z.string().default("en"),

  // Media tab
  mediaPresence: z.enum(["any", "with_media", "without_media"]).default("any"),
  images: z.boolean().default(true),
  twitterImages: z.boolean().default(true),
  videos: z.boolean().default(true),
  periscope: z.boolean().default(true),
  nativeVideo: z.boolean().default(true),
  consumerVideo: z.boolean().default(true),
  proVideo: z.boolean().default(true),
  vine: z.boolean().default(true),
  spaces: z.boolean().default(true),
  links: z.boolean().default(true),
  mentions: z.boolean().default(true),
  news: z.boolean().default(true),
  hashtags: z.boolean().default(true),
  hideSensitiveContent: z.boolean().default(true),

  // Engagement tab
  engagement: z
    .enum(["any", "with_engagement", "without_engagement"])
    .default("any"),
  minLikes: z.string().default(""),
  maxLikes: z.string().default(""),
  minReplies: z.string().default(""),
  maxReplies: z.string().default(""),
  minRetweets: z.string().default(""),
  maxRetweets: z.string().default(""),
});

export type FilterFormData = z.infer<typeof filterSchema>;
