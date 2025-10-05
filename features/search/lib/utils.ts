// features/search/lib/utils.ts
import type { FilterState, SortState } from "../types";
import type { FilterFormData, SortFormData } from "./schemas";

export function filterStateToFormData(
  filterState: FilterState
): FilterFormData {
  return {
    // Users
    verified: filterState.verified ?? true,
    unverified: filterState.unverified ?? true,
    from: filterState.from ?? "",
    to: filterState.to ?? "",
    mention: filterState.mention ?? "",
    list: filterState.list ?? "",

    // Date
    dateRange: filterState.dateRange ?? "all_time",
    lastXValue: filterState.lastXValue ?? "",
    lastXUnit: filterState.lastXUnit ?? "days",
    customRangeStart: filterState.customRangeStart,
    customRangeEnd: filterState.customRangeEnd,

    // Content
    url: filterState.url ?? "",
    language: filterState.language ?? "all",
    excludeUsers: filterState.excludeUsers ?? [],

    // Media
    mediaPresence: filterState.mediaPresence ?? "any",
    images: filterState.images ?? true,
    twitterImages: filterState.twitterImages ?? true,
    videos: filterState.videos ?? true,
    periscope: filterState.periscope ?? true,
    nativeVideo: filterState.nativeVideo ?? true,
    consumerVideo: filterState.consumerVideo ?? true,
    proVideo: filterState.proVideo ?? true,
    vine: filterState.vine ?? true,
    spaces: filterState.spaces ?? true,
    links: filterState.links ?? true,
    mentions: filterState.mentions ?? true,
    news: filterState.news ?? true,
    hashtags: filterState.hashtags ?? true,
    hideSensitiveContent: filterState.hideSensitiveContent ?? true,

    // Engagement
    engagement: filterState.engagement ?? "any",
    minLikes: filterState.minLikes ?? "",
    maxLikes: filterState.maxLikes ?? "",
    minReplies: filterState.minReplies ?? "",
    maxReplies: filterState.maxReplies ?? "",
    minRetweets: filterState.minRetweets ?? "",
    maxRetweets: filterState.maxRetweets ?? "",
  };
}

export function formDataToFilterState(
  formData: Partial<FilterFormData>
): FilterState {
  const result: FilterState = {};

  // Users
  if (formData.verified !== undefined) result.verified = formData.verified;
  if (formData.unverified !== undefined)
    result.unverified = formData.unverified;
  if (formData.from?.trim()) result.from = formData.from.trim();
  if (formData.to?.trim()) result.to = formData.to.trim();
  if (formData.mention?.trim()) result.mention = formData.mention.trim();
  if (formData.list?.trim()) result.list = formData.list.trim();

  // Date
  if (formData.dateRange) result.dateRange = formData.dateRange;
  if (formData.lastXValue?.trim())
    result.lastXValue = formData.lastXValue.trim();
  if (formData.lastXUnit) result.lastXUnit = formData.lastXUnit;
  if (formData.customRangeStart)
    result.customRangeStart = formData.customRangeStart;
  if (formData.customRangeEnd) result.customRangeEnd = formData.customRangeEnd;

  // Content
  if (formData.url?.trim()) result.url = formData.url.trim();
  if (formData.language) result.language = formData.language;
  if (Array.isArray(formData.excludeUsers))
    result.excludeUsers = formData.excludeUsers;

  // Media
  if (formData.mediaPresence) result.mediaPresence = formData.mediaPresence;
  if (formData.images !== undefined) result.images = formData.images;
  if (formData.twitterImages !== undefined)
    result.twitterImages = formData.twitterImages;
  if (formData.videos !== undefined) result.videos = formData.videos;
  if (formData.periscope !== undefined) result.periscope = formData.periscope;
  if (formData.nativeVideo !== undefined)
    result.nativeVideo = formData.nativeVideo;
  if (formData.consumerVideo !== undefined)
    result.consumerVideo = formData.consumerVideo;
  if (formData.proVideo !== undefined) result.proVideo = formData.proVideo;
  if (formData.vine !== undefined) result.vine = formData.vine;
  if (formData.spaces !== undefined) result.spaces = formData.spaces;
  if (formData.links !== undefined) result.links = formData.links;
  if (formData.mentions !== undefined) result.mentions = formData.mentions;
  if (formData.news !== undefined) result.news = formData.news;
  if (formData.hashtags !== undefined) result.hashtags = formData.hashtags;
  if (formData.hideSensitiveContent !== undefined)
    result.hideSensitiveContent = formData.hideSensitiveContent;

  // Engagement
  if (formData.engagement) result.engagement = formData.engagement;
  if (formData.minLikes?.trim()) result.minLikes = formData.minLikes.trim();
  if (formData.maxLikes?.trim()) result.maxLikes = formData.maxLikes.trim();
  if (formData.minReplies?.trim())
    result.minReplies = formData.minReplies.trim();
  if (formData.maxReplies?.trim())
    result.maxReplies = formData.maxReplies.trim();
  if (formData.minRetweets?.trim())
    result.minRetweets = formData.minRetweets.trim();
  if (formData.maxRetweets?.trim())
    result.maxRetweets = formData.maxRetweets.trim();

  return result;
}

export function ensureCompleteFormData(
  partialData: Partial<FilterFormData>
): FilterFormData {
  return filterStateToFormData(formDataToFilterState(partialData));
}

export function getDefaultFilterState(): FilterState {
  return {
    verified: true,
    unverified: true,
    dateRange: "all_time",
    language: "all",
    excludeUsers: [],
    mediaPresence: "any",
    images: true,
    twitterImages: true,
    videos: true,
    periscope: true,
    nativeVideo: true,
    consumerVideo: true,
    proVideo: true,
    vine: true,
    spaces: true,
    links: true,
    mentions: true,
    news: true,
    hashtags: true,
    hideSensitiveContent: true,
    engagement: "any",
  };
}
// Add sort utility functions
export function getDefaultSortState(): SortState {
  return {
    sortBy: "newest_first",
  };
}

export function sortStateToFormData(sortState: SortState): SortFormData {
  return {
    sortBy: sortState.sortBy ?? "newest_first",
  };
}

export function formDataToSortState(
  formData: Partial<SortFormData>
): SortState {
  return {
    sortBy: formData.sortBy ?? "newest_first",
  };
}
