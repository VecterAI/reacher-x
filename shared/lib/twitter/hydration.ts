import type { Tweet, User } from "@/features/threads/types";

export type TwitterTimelineMode = "posts" | "replies" | "quotes";

type TwitterProfileUrlEntity = {
  url: string;
  expanded_url: string;
  display_url: string;
  indices: [number, number];
};

export type HydratedTwitterProfile = User & {
  username?: string;
  banner_url?: string;
  entities?: {
    description?: {
      urls?: TwitterProfileUrlEntity[];
    };
    url?: {
      urls?: TwitterProfileUrlEntity[];
    };
  };
};

export type HydratedTwitterTimelinePage = {
  mode: TwitterTimelineMode;
  tweets: Tweet[];
  nextCursor?: string;
  fetchedAt: number;
};

export type HydratedTwitterProfilePayload = {
  username: string;
  profileUserId: string;
  profile: HydratedTwitterProfile;
  timeline: HydratedTwitterTimelinePage;
};

export type HydratedTwitterPostPayload = {
  tweet: Tweet | null;
  fetchedAt: number;
};

export type HydratedTwitterPostsPayload = {
  tweets: Tweet[];
  fetchedAt: number;
};

export type HydratedTwitterConversationPayload = {
  threadId: string;
  conversationId: string;
  tweets: Tweet[];
  fetchedAt: number;
};
