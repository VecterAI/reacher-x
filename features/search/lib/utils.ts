// features/search/lib/utils.ts
// Minimal utilities for UI components (functionality removed for v4)

import type { FilterState } from "../types";
import type { FilterFormData } from "./schemas";

export function getDefaultFilterState(): FilterState {
  return {};
}

export function filterStateToFormData(state: FilterState): FilterFormData {
  return {
    verified: state.verified,
    unverified: state.unverified,
    from: state.from,
    to: state.to,
    mention: state.mention,
    list: state.list,
    excludeUsers: state.excludeUsers,
    dateRange: state.dateRange,
    mediaPresence: state.mediaPresence,
    periscope: state.periscope,
    nativeVideo: state.nativeVideo,
    consumerVideo: state.consumerVideo,
    proVideo: state.proVideo,
    vine: state.vine,
    mentions: state.mentions,
    news: state.news,
    hashtags: state.hashtags,
    engagement: state.engagement,
    language: state.language,
  };
}

export function formDataToFilterState(formData: FilterFormData): FilterState {
  return {
    verified: formData.verified,
    unverified: formData.unverified,
    from: formData.from,
    to: formData.to,
    mention: formData.mention,
    list: formData.list,
    excludeUsers: formData.excludeUsers,
    dateRange: formData.dateRange,
    mediaPresence: formData.mediaPresence,
    periscope: formData.periscope,
    nativeVideo: formData.nativeVideo,
    consumerVideo: formData.consumerVideo,
    proVideo: formData.proVideo,
    vine: formData.vine,
    mentions: formData.mentions,
    news: formData.news,
    hashtags: formData.hashtags,
    engagement: formData.engagement,
    language: formData.language,
  };
}
