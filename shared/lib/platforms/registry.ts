// shared/lib/platforms/registry.ts
// Lightweight registry for supported platforms.
// Note: We intentionally don't import UI components here to avoid heavy cross‑bundle deps.
import type { PlatformDefinition } from "./types";

export const PLATFORM_REGISTRY: Record<string, PlatformDefinition<any>> = {
  // Twitter already exists in the app, but we keep a placeholder here for symmetry.
  twitter: {
    id: "twitter",
    label: "Twitter",
    capabilities: {
      tabs: ["all", "posts", "replies", "quotes"],
      sortableBy: [
        "newest_first",
        "oldest_first",
        "relevance",
        // Twitter-specific client sorts already exist in SortContent
      ],
    },
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    capabilities: {
      tabs: ["all", "posts", "reposts"],
      // Surface API sorts + client-side metric sorts.
      sortableBy: [
        "newest_first",
        "oldest_first",
        "relevance",
        "date_posted",
        "most_reacted_first",
        "least_reacted_first",
        "most_commented_first",
        "least_commented_first",
        "most_reposted_first",
        "least_reposted_first",
      ],
    },
  },
};
