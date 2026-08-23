"use client";

import type { Tweet } from "@/features/threads/types";
import { QuoteTweetCard } from "@/features/webapp/ui/components/tweet/QuoteTweetCard";
import { QuoteTweetCardSkeleton } from "@/features/webapp/ui/components/tweet/QuoteTweetCardSkeleton";
import { useHydratedTwitterPosts } from "@/shared/hooks/useHydratedTwitterPosts";
import type { TwitterPostSummary } from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";
import type { SharedConversationPost } from "./types";

interface ConversationSharedPostProps {
  post: SharedConversationPost;
}

function toTwitterPostSummary(
  post: SharedConversationPost
): TwitterPostSummary | undefined {
  if (!post.id) return undefined;

  return {
    platform: "twitter",
    ref: {
      platform: "twitter",
      postId: post.id,
      authorId: post.authorId,
      authorHandle: post.authorHandle,
      url: post.url,
    },
    url: post.url,
    textPreview: post.text ?? "",
    createdAt: post.createdAt ? Date.parse(post.createdAt) : undefined,
    author:
      post.authorId ||
      post.authorHandle ||
      post.authorName ||
      post.authorAvatarUrl
        ? {
            id: post.authorId,
            handle: post.authorHandle,
            name: post.authorName,
            avatarUrl: post.authorAvatarUrl,
          }
        : undefined,
    media: post.media?.flatMap((item) => {
      const url = item.url ?? item.previewUrl;
      if (!url) return [];
      const normalizedType = item.type.toLowerCase();
      const type =
        normalizedType === "image" || normalizedType === "photo"
          ? ("photo" as const)
          : normalizedType === "video"
            ? ("video" as const)
            : normalizedType === "gif" || normalizedType === "animated_gif"
              ? ("animated_gif" as const)
              : null;
      if (!type) return [];
      return [
        {
          type,
          url,
          previewUrl: item.previewUrl,
          altText: item.altText,
          width: item.width,
          height: item.height,
        },
      ];
    }),
  };
}

export function ConversationSharedPost({ post }: ConversationSharedPostProps) {
  const summary = toTwitterPostSummary(post);
  const { tweetsById, resultsById, isLoading } = useHydratedTwitterPosts(
    summary ? [summary.ref.postId] : []
  );

  if (!summary) return null;

  const hydratedTweet = tweetsById[summary.ref.postId] as Tweet | undefined;
  if (isLoading && !hydratedTweet && !resultsById[summary.ref.postId]) {
    return <QuoteTweetCardSkeleton />;
  }

  return (
    <QuoteTweetCard
      tweet={hydratedTweet ?? toFallbackTweetFromSummary(summary)}
      bodyLineClamp={3}
      className="bg-background"
    />
  );
}
