// features/search/lib/filterUtils.ts
import type { Tweet } from "@/features/threads/types";
import type { FilterState } from "../types";

export interface FilterResult {
  filteredTweets: Tweet[];
  filterSummary: string;
  appliedFilters: string[];
}

/**
 * Client-side filtering implementation for Twitter search results
 * This implements all the filters described in the requirements
 */
export function applyClientSideFilters(
  tweets: Tweet[],
  filters: FilterState
): FilterResult {
  if (!tweets || tweets.length === 0) {
    return {
      filteredTweets: [],
      filterSummary: "No tweets to filter",
      appliedFilters: [],
    };
  }

  const appliedFilters: string[] = [];
  let filteredTweets = [...tweets];

  // Users tab filters
  filteredTweets = applyUserFilters(filteredTweets, filters, appliedFilters);

  // Date tab filters
  filteredTweets = applyDateFilters(filteredTweets, filters, appliedFilters);

  // Content tab filters
  filteredTweets = applyContentFilters(filteredTweets, filters, appliedFilters);

  // Media tab filters
  filteredTweets = applyMediaFilters(filteredTweets, filters, appliedFilters);

  // Engagement tab filters
  filteredTweets = applyEngagementFilters(
    filteredTweets,
    filters,
    appliedFilters
  );

  const filterSummary = generateFilterSummary(
    tweets.length,
    filteredTweets.length,
    appliedFilters
  );

  return {
    filteredTweets,
    filterSummary,
    appliedFilters,
  };
}

function applyUserFilters(
  tweets: Tweet[],
  filters: FilterState,
  appliedFilters: string[]
): Tweet[] {
  let filtered = tweets;

  // Verification status filters
  if (filters.verified !== undefined || filters.unverified !== undefined) {
    // Dev-only insights handled elsewhere; avoid logs in production
    // logger.info could be added if needed
    // logger.info("[FILTER_UTILS] Applying verification filters:", {
    // verified: filters.verified,
    // unverified: filters.unverified,
    // totalTweets: tweets.length,
    // verifiedTweets: tweets.filter((t) => t.user?.verified === true).length,
    // unverifiedTweets: tweets.filter((t) => t.user?.verified === false).length,
    // });

    // If both are true, show all (default behavior)
    if (filters.verified === true && filters.unverified === true) {
      // No filtering needed - show all
      // no-op log in production
    }
    // If only verified is true, show only verified users
    else if (filters.verified === true && filters.unverified === false) {
      filtered = filtered.filter((tweet) => tweet.user?.verified === true);
      appliedFilters.push("Verified users only");
    }
    // If only unverified is true, show only unverified users
    else if (filters.verified === false && filters.unverified === true) {
      filtered = filtered.filter((tweet) => tweet.user?.verified === false);
      appliedFilters.push("Unverified users only");
    }
    // If both are false, show none (edge case)
    else if (filters.verified === false && filters.unverified === false) {
      filtered = [];
      appliedFilters.push("No users (both verified and unverified disabled)");
    }
  }

  // From user filter
  if (filters.from?.trim()) {
    const fromUser = filters.from.trim().toLowerCase();
    filtered = filtered.filter((tweet) => {
      const screenName = tweet.user?.screen_name?.toLowerCase();
      const name = tweet.user?.name?.toLowerCase();
      return screenName === fromUser || name === fromUser;
    });
    appliedFilters.push(`From: ${filters.from}`);
  }

  // To user filter (replies to specific user)
  if (filters.to?.trim()) {
    const toUser = filters.to.trim().toLowerCase();
    filtered = filtered.filter((tweet) => {
      const replyToScreenName = tweet.in_reply_to_screen_name?.toLowerCase();
      return replyToScreenName === toUser;
    });
    appliedFilters.push(`To: ${filters.to}`);
  }

  // Mention filter
  if (filters.mention?.trim()) {
    const mentionUser = filters.mention.trim().toLowerCase();
    filtered = filtered.filter((tweet) => {
      const mentions = tweet.entities?.user_mentions || [];
      return mentions.some(
        (mention) => mention.screen_name.toLowerCase() === mentionUser
      );
    });
    appliedFilters.push(`Mentioning: ${filters.mention}`);
  }

  // List filter (not implemented on client-side - would need API support)
  if (filters.list?.trim()) {
    appliedFilters.push(`List: ${filters.list} (not implemented)`);
  }

  // Exclude users by screen_name (case-insensitive)
  if (Array.isArray(filters.excludeUsers) && filters.excludeUsers.length > 0) {
    const excludeSet = new Set(
      filters.excludeUsers
        .map((u) => u.trim().replace(/^@+/, "").toLowerCase())
        .filter(Boolean)
    );
    filtered = filtered.filter((tweet) => {
      const screen = tweet.user?.screen_name?.toLowerCase();
      return screen ? !excludeSet.has(screen) : true;
    });
    appliedFilters.push(`Excluded users (${excludeSet.size})`);
  }

  return filtered;
}

function applyDateFilters(
  tweets: Tweet[],
  filters: FilterState,
  appliedFilters: string[]
): Tweet[] {
  let filtered = tweets;

  if (filters.dateRange && filters.dateRange !== "all_time") {
    // Dev-only
    // logger.info("[FILTER_UTILS] Applying date filter:", {
    // dateRange: filters.dateRange,
    // totalTweets: tweets.length,
    // customRangeStart: filters.customRangeStart,
    // customRangeEnd: filters.customRangeEnd,
    // });

    const now = new Date();
    let cutoffDate: Date | undefined;

    switch (filters.dateRange) {
      case "last_1_hour":
        cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "last_24_hours":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "last_7_days":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "last_30_days":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last_365_days":
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "last_x":
        if (filters.lastXValue && filters.lastXUnit) {
          const value = parseInt(filters.lastXValue);
          if (!isNaN(value)) {
            const multiplier =
              filters.lastXUnit === "minutes"
                ? 60 * 1000
                : filters.lastXUnit === "hours"
                  ? 60 * 60 * 1000
                  : 24 * 60 * 60 * 1000;
            cutoffDate = new Date(now.getTime() - value * multiplier);
            appliedFilters.push(`Last ${value} ${filters.lastXUnit}`);
          }
        }
        break; // Use break instead of return to continue to the filtering logic below
      case "custom_range":
        if (filters.customRangeStart || filters.customRangeEnd) {
          const startDate = filters.customRangeStart;
          const endDate = filters.customRangeEnd;

          filtered = filtered.filter((tweet) => {
            const tweetDate = new Date(tweet.tweet_created_at || "");
            if (isNaN(tweetDate.getTime())) return false;

            if (startDate && tweetDate < startDate) return false;
            if (endDate && tweetDate > endDate) return false;
            return true;
          });
          appliedFilters.push("Custom date range");
        }
        return filtered;
      default:
        return filtered;
    }

    // Only apply cutoff date filtering if we have a valid cutoff date
    if (cutoffDate) {
      // Debug: Show some tweet dates
      const sampleTweets = filtered.slice(0, 3);

      filtered = filtered.filter((tweet) => {
        const tweetDate = new Date(tweet.tweet_created_at || "");
        return !isNaN(tweetDate.getTime()) && tweetDate >= cutoffDate;
      });

      appliedFilters.push(filters.dateRange.replace(/_/g, " "));
    }
  }

  return filtered;
}

function applyContentFilters(
  tweets: Tweet[],
  filters: FilterState,
  appliedFilters: string[]
): Tweet[] {
  let filtered = tweets;

  // URL filter
  if (filters.url?.trim()) {
    const urlFilter = filters.url.trim().toLowerCase();
    filtered = filtered.filter((tweet) => {
      const urls = tweet.entities?.urls || [];
      return urls.some(
        (url) =>
          url.expanded_url.toLowerCase().includes(urlFilter) ||
          url.display_url.toLowerCase().includes(urlFilter)
      );
    });
    appliedFilters.push(`URL contains: ${filters.url}`);
  }

  // Language filter
  if (filters.language && filters.language !== "all") {
    filtered = filtered.filter((tweet) => {
      return tweet.lang === filters.language;
    });
    appliedFilters.push(`Language: ${filters.language}`);
  }

  return filtered;
}

function applyMediaFilters(
  tweets: Tweet[],
  filters: FilterState,
  appliedFilters: string[]
): Tweet[] {
  let filtered = tweets;

  // Media presence filter
  if (filters.mediaPresence && filters.mediaPresence !== "any") {
    if (filters.mediaPresence === "with_media") {
      filtered = filtered.filter((tweet) => {
        return tweet.entities?.media && tweet.entities.media.length > 0;
      });
      appliedFilters.push("With media");
    } else if (filters.mediaPresence === "without_media") {
      filtered = filtered.filter((tweet) => {
        return !tweet.entities?.media || tweet.entities.media.length === 0;
      });
      appliedFilters.push("Without media");
    }
  }

  // Media type filters (only apply if "With media" is selected)
  if (
    filters.mediaPresence === "with_media" ||
    filters.mediaPresence === "any"
  ) {
    const mediaFilters: Array<{
      key: keyof FilterState;
      type: string;
      label: string;
    }> = [
      { key: "images", type: "photo", label: "Images" },
      { key: "videos", type: "video", label: "Videos" },
      { key: "periscope", type: "periscope", label: "Periscope" },
      { key: "nativeVideo", type: "video", label: "Native video" },
      { key: "consumerVideo", type: "video", label: "Consumer video" },
      { key: "proVideo", type: "video", label: "Pro video" },
      { key: "vine", type: "vine", label: "Vine" },
      { key: "spaces", type: "spaces", label: "Spaces" },
    ];

    mediaFilters.forEach(({ key, type, label }) => {
      if (filters[key] === false) {
        filtered = filtered.filter((tweet) => {
          const media = tweet.entities?.media || [];
          return !media.some((m) => m.type === type);
        });
        appliedFilters.push(`No ${label.toLowerCase()}`);
      }
    });
  }

  // Content filters
  const contentFilters: Array<{
    key: keyof FilterState;
    label: string;
    check: (tweet: Tweet) => boolean;
  }> = [
    {
      key: "links",
      label: "Links",
      check: (tweet) => (tweet.entities?.urls?.length || 0) > 0,
    },
    {
      key: "mentions",
      label: "Mentions",
      check: (tweet) => (tweet.entities?.user_mentions?.length || 0) > 0,
    },
    {
      key: "hashtags",
      label: "Hashtags",
      check: (tweet) => (tweet.entities?.hashtags?.length || 0) > 0,
    },
  ];

  contentFilters.forEach(({ key, label, check }) => {
    if (filters[key] === false) {
      filtered = filtered.filter((tweet) => !check(tweet));
      appliedFilters.push(`No ${label.toLowerCase()}`);
    }
  });

  // News filter (not implemented on client-side - would need domain analysis)
  if (filters.news === false) {
    appliedFilters.push("No news (not implemented)");
  }

  // Hide sensitive content (not implemented on client-side - would need API data)
  if (filters.hideSensitiveContent === false) {
    appliedFilters.push("Show sensitive content (not implemented)");
  }

  return filtered;
}

function applyEngagementFilters(
  tweets: Tweet[],
  filters: FilterState,
  appliedFilters: string[]
): Tweet[] {
  let filtered = tweets;

  // Engagement presence filter
  if (filters.engagement && filters.engagement !== "any") {
    if (filters.engagement === "with_engagement") {
      filtered = filtered.filter((tweet) => {
        const likes = tweet.favorite_count || 0;
        const retweets = tweet.retweet_count || 0;
        const replies = tweet.reply_count || 0;
        return likes > 0 || retweets > 0 || replies > 0;
      });
      appliedFilters.push("With engagement");
    } else if (filters.engagement === "without_engagement") {
      filtered = filtered.filter((tweet) => {
        const likes = tweet.favorite_count || 0;
        const retweets = tweet.retweet_count || 0;
        const replies = tweet.reply_count || 0;
        return likes === 0 && retweets === 0 && replies === 0;
      });
      appliedFilters.push("Without engagement");
    }
  }

  // Min/Max engagement filters
  const engagementFilters: Array<{
    key: keyof FilterState;
    maxKey: keyof FilterState;
    field: keyof Tweet;
    label: string;
  }> = [
    {
      key: "minLikes",
      maxKey: "maxLikes",
      field: "favorite_count",
      label: "likes",
    },
    {
      key: "minReplies",
      maxKey: "maxReplies",
      field: "reply_count",
      label: "replies",
    },
    {
      key: "minRetweets",
      maxKey: "maxRetweets",
      field: "retweet_count",
      label: "retweets",
    },
  ];

  engagementFilters.forEach(({ key, maxKey, field, label }) => {
    const minValue = filters[key] as string;
    const maxValue = filters[maxKey] as string;

    if (minValue?.trim()) {
      const min = parseInt(minValue);
      if (!isNaN(min)) {
        filtered = filtered.filter((tweet) => {
          const value = (tweet[field] as number) || 0;
          return value >= min;
        });
        appliedFilters.push(`Min ${label}: ${minValue}`);
      }
    }

    if (maxValue?.trim()) {
      const max = parseInt(maxValue);
      if (!isNaN(max)) {
        filtered = filtered.filter((tweet) => {
          const value = (tweet[field] as number) || 0;
          return value <= max;
        });
        appliedFilters.push(`Max ${label}: ${maxValue}`);
      }
    }
  });

  return filtered;
}

function generateFilterSummary(
  originalCount: number,
  filteredCount: number,
  appliedFilters: string[]
): string {
  if (appliedFilters.length === 0) {
    return `Showing all ${originalCount} tweets`;
  }

  const reduction = originalCount - filteredCount;
  const reductionPercentage =
    originalCount > 0 ? Math.round((reduction / originalCount) * 100) : 0;

  return `${filteredCount} of ${originalCount} tweets (${reductionPercentage}% reduction)`;
}

/**
 * Check if a filter can be implemented on the client-side
 */
export function getUnimplementedFilters(filters: FilterState): string[] {
  const unimplemented: string[] = [];

  // List filter - requires API support
  if (filters.list?.trim()) {
    unimplemented.push("List filter - requires API support");
  }

  // News filter - requires domain analysis
  if (filters.news === false) {
    unimplemented.push("News filter - requires domain analysis");
  }

  // Hide sensitive content - requires API data
  if (filters.hideSensitiveContent === false) {
    unimplemented.push("Hide sensitive content - requires API data");
  }

  return unimplemented;
}

/**
 * Get supported languages for the language filter
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
  { code: "cs", name: "Czech" },
  { code: "hu", name: "Hungarian" },
  { code: "ro", name: "Romanian" },
  { code: "bg", name: "Bulgarian" },
  { code: "hr", name: "Croatian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "et", name: "Estonian" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mt", name: "Maltese" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "tl", name: "Tagalog" },
  { code: "bn", name: "Bengali" },
  { code: "ur", name: "Urdu" },
  { code: "fa", name: "Persian" },
  { code: "am", name: "Amharic" },
  { code: "bo", name: "Tibetan" },
  { code: "ca", name: "Catalan" },
  { code: "ch", name: "Cherokee" },
  { code: "dv", name: "Maldivian" },
  { code: "gu", name: "Gujarati" },
  { code: "ht", name: "Haitian Creole" },
  { code: "hy", name: "Armenian" },
  { code: "in", name: "Indonesian" },
  { code: "is", name: "Icelandic" },
  { code: "iw", name: "Hebrew" },
  { code: "ka", name: "Georgian" },
  { code: "km", name: "Khmer" },
  { code: "kn", name: "Kannada" },
  { code: "lo", name: "Lao" },
  { code: "ml", name: "Malayalam" },
  { code: "my", name: "Myanmar" },
  { code: "ne", name: "Nepali" },
  { code: "or", name: "Oriya" },
  { code: "pa", name: "Panjabi" },
  { code: "si", name: "Sinhala" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
] as const;
