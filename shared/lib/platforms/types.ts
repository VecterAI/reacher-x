// shared/lib/platforms/types.ts
// Core cross-platform types and interfaces for multi-network search and rendering.
// Keep deliberately small and UI-agnostic so features can compose them.

export type PlatformId =
  | "twitter"
  | "linkedin"
  | "reddit"
  | "threads"
  | "bluesky";

export type QueryKind =
  | "all"
  | "posts"
  | "replies" // not for LinkedIn initial integration
  | "quotes" // Twitter only
  | "reposts"; // LinkedIn equivalent to retweets

export type SortOrder =
  | "newest_first"
  | "oldest_first"
  | "most_reacted_first"
  | "least_reacted_first"
  | "most_commented_first"
  | "least_commented_first"
  | "most_reposted_first"
  | "least_reposted_first"
  | "relevance"
  | "date_posted";

export interface UnifiedAuthor {
  id?: string;
  handle?: string;
  name?: string;
  avatarUrl?: string;
  profileUrl?: string;
  headline?: string; // LinkedIn
  type?: string;
}

export interface UnifiedMedia {
  type: "image" | "video" | "link";
  url: string;
  // Optional display hints
  width?: number;
  height?: number;
  posterUrl?: string;
  title?: string; // for link cards
  description?: string; // for link cards
  faviconUrl?: string; // for link cards
}

export interface UnifiedPost {
  id: string;
  platform: PlatformId;
  url?: string;
  author: UnifiedAuthor;
  text: string;
  createdAt: number; // epoch ms
  metrics?: {
    reactions?: number; // likes + reactions
    comments?: number;
    reposts?: number;
    quotes?: number;
    views?: number;
  };
  media?: UnifiedMedia[];
  raw?: unknown; // full provider payload for platform-specific use
}

export interface SearchPage<TCursor = unknown> {
  posts: UnifiedPost[];
  cursor?: TCursor;
  hasNextPage: boolean;
  meta?: Record<string, unknown>;
}

export interface PlatformCapabilities {
  tabs: QueryKind[];
  sortableBy: SortOrder[];
}

export interface PlatformSearchAdapter<TCursor = unknown> {
  // Minimal shape for now — the UI can call this with a query and page cursor.
  search(params: {
    q: string;
    exact: boolean;
    kind: QueryKind;
    sort?: SortOrder;
    cursor?: TCursor;
  }): Promise<SearchPage<TCursor>>;
}

export interface PlatformDefinition<TCursor = unknown> {
  id: PlatformId;
  label: string;
  capabilities: PlatformCapabilities;
  adapter?: PlatformSearchAdapter<TCursor>;
}
