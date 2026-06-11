"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { getLinkedInPostReactionKeys } from "@/shared/hooks/useLinkedInPostReactionState";

type LinkedInEngagementRow = {
  viewerReaction: string | null;
  reactionCount?: number;
  commented: boolean;
  updatedAt: number;
};

function dedupeSortedPostKeys(posts: UnifiedPost[]) {
  return Array.from(
    new Set(posts.flatMap((post) => getLinkedInPostReactionKeys(post)))
  ).sort();
}

function findEngagementForPost(
  post: UnifiedPost,
  engagements: Record<string, LinkedInEngagementRow> | undefined
) {
  if (!engagements) {
    return undefined;
  }

  for (const key of getLinkedInPostReactionKeys(post)) {
    const engagement = engagements[key];
    if (engagement) {
      return engagement;
    }
  }

  return undefined;
}

function mergeLinkedInEngagementIntoPost(
  post: UnifiedPost,
  engagement: LinkedInEngagementRow | undefined
) {
  if (!engagement) {
    return post;
  }

  const raw =
    post.raw && typeof post.raw === "object"
      ? (post.raw as Record<string, unknown>)
      : {};

  return {
    ...post,
    metrics: {
      ...post.metrics,
      reactions:
        typeof engagement.reactionCount === "number"
          ? engagement.reactionCount
          : post.metrics?.reactions,
    },
    raw: {
      ...raw,
      user_reacted: engagement.viewerReaction ?? undefined,
      viewer_commented: engagement.commented,
    },
  } satisfies UnifiedPost;
}

export function useLinkedInPostEngagementMerge(posts: UnifiedPost[]) {
  const postKeys = React.useMemo(() => dedupeSortedPostKeys(posts), [posts]);

  const engagements = useQuery(
    api.linkedinEngagement.getEngagementsForPostKeys,
    postKeys.length > 0 ? { postKeys } : "skip"
  );

  return React.useMemo(
    () =>
      posts.map((post) =>
        mergeLinkedInEngagementIntoPost(
          post,
          findEngagementForPost(post, engagements)
        )
      ),
    [engagements, posts]
  );
}
