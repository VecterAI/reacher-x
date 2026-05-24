import type { Tweet } from "@/features/threads/types";
import {
  createEmptyTwitterViewerState,
  type TwitterViewerState,
} from "./contracts";

export type ConvexPostEngagement = {
  liked: boolean;
  retweeted: boolean;
  commented: boolean;
};

export type ConvexFollowingRow = {
  following: boolean;
};

/**
 * Merge durable Convex engagement + optional follow map into tweet viewer state.
 * Used when X feed hydration skips expensive list-pagination (`includeViewerState: false`).
 */
export function mergeLocalEngagementIntoTweet(
  tweet: Tweet,
  args: {
    engagement?: ConvexPostEngagement | null;
    followingByTargetUserId?: Record<string, ConvexFollowingRow> | undefined;
    /** When true (e.g. prospect interaction row), viewer commented on this post. */
    overlayCommented?: boolean;
  }
): Tweet {
  const postId = tweet.id_str ?? (tweet.id != null ? String(tweet.id) : "");
  if (!postId) {
    return tweet;
  }

  const prior = tweet.viewerState;
  const authorId = tweet.user?.id_str;
  const following =
    authorId && args.followingByTargetUserId
      ? args.followingByTargetUserId[authorId]?.following
      : undefined;

  const hasEngagement = args.engagement != null;
  const hasOverlay = args.overlayCommented === true;
  const hasFollow = following !== undefined;

  const liked = args.engagement?.liked ?? prior?.liked ?? false;
  const retweeted = args.engagement?.retweeted ?? prior?.retweeted ?? false;
  const commented = hasOverlay
    ? true
    : (args.engagement?.commented ?? prior?.commented ?? false);
  const followingAuthor = hasFollow
    ? Boolean(following)
    : (prior?.followingAuthor ?? false);

  if (!hasEngagement && !hasOverlay && !hasFollow && !prior) {
    return {
      ...tweet,
      viewerState: createEmptyTwitterViewerState({
        postId,
        resolution: "unknown",
        source: "none",
      }),
    };
  }

  const viewerState: TwitterViewerState = {
    ...createEmptyTwitterViewerState({
      postId,
      resolution: "verified",
      source: "local",
    }),
    liked,
    retweeted,
    commented,
    followingAuthor,
    bookmarked: prior?.bookmarked ?? false,
    requiresConnection: prior?.requiresConnection ?? false,
    connectedAccountId: prior?.connectedAccountId,
    canAct: prior?.canAct ?? true,
  };

  return {
    ...tweet,
    viewerState,
  };
}
