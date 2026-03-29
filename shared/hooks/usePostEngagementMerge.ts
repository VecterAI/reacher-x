"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";

/**
 * Merges Convex-stored engagement + follow state for a single post (detail / reply panel).
 */
export function usePostEngagementMerge(tweet: Tweet | null): Tweet | null {
  const postId = tweet?.id_str?.trim() ?? "";
  const authorId = tweet?.user?.id_str?.trim();

  const engagements = useQuery(
    api.twitterEngagement.getEngagementsForPosts,
    postId ? { postIds: [postId] } : "skip"
  );

  const followings = useQuery(
    api.twitterEngagement.getFollowingsForTargets,
    authorId ? { targetUserIds: [authorId] } : "skip"
  );

  return React.useMemo(() => {
    if (!tweet?.id_str) {
      return null;
    }
    const e = engagements?.[tweet.id_str];
    return mergeLocalEngagementIntoTweet(tweet, {
      engagement: e
        ? {
            liked: e.liked,
            retweeted: e.retweeted,
            commented: e.commented,
          }
        : undefined,
      followingByTargetUserId: followings,
    });
  }, [tweet, engagements, followings]);
}
