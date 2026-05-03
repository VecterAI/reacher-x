"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Tweet } from "@/features/threads/types";
import { mergeLocalEngagementIntoTweet } from "@/shared/lib/twitter/mergeViewerState";

function dedupeSortedTweetIds(tweets: Tweet[]): string[] {
  return Array.from(
    new Set(
      tweets
        .map((tweet) => tweet.id_str?.trim())
        .filter((tweetId): tweetId is string => Boolean(tweetId))
    )
  ).sort();
}

export function useTwitterTimelineEngagementMerge(tweets: Tweet[]) {
  const tweetIds = React.useMemo(() => dedupeSortedTweetIds(tweets), [tweets]);

  const engagements = useQuery(
    api.twitterEngagement.getEngagementsForPosts,
    tweetIds.length > 0 ? { postIds: tweetIds } : "skip"
  );

  const authorIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const tweet of tweets) {
      const authorId = tweet.user?.id_str?.trim();
      if (authorId) {
        ids.add(authorId);
      }
    }
    return Array.from(ids).sort();
  }, [tweets]);

  const followings = useQuery(
    api.twitterEngagement.getFollowingsForTargets,
    authorIds.length > 0 ? { targetUserIds: authorIds } : "skip"
  );

  return React.useMemo(
    () =>
      tweets.map((tweet) => {
        if (!tweet.id_str) {
          return tweet;
        }
        const tweetId = tweet.id_str;
          const engagement = engagements?.[tweetId];
        return mergeLocalEngagementIntoTweet(tweet, {
          engagement: engagement
            ? {
                liked: engagement.liked,
                retweeted: engagement.retweeted,
                commented: engagement.commented,
              }
            : undefined,
          followingByTargetUserId: followings,
        });
      }),
    [tweets, engagements, followings]
  );
}
