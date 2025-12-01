// features/webapp/ui/components/linkedin/LinkedInPostCard.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { LinkedInMediaGrid } from "./LinkedInMediaGrid";
import { LinkedInMenu } from "./LinkedInMenu";
import { LinkedInHeader } from "./LinkedInHeader";
import { LinkedInBody } from "./LinkedInBody";
import { LinkedInFooter } from "./LinkedInFooter";
import { QuoteLinkedInCard } from "./QuoteLinkedInCard";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";

export interface LinkedInPostCardProps {
  post: UnifiedPost;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQueries?: string[];
  quotedPost?: UnifiedPost;
  className?: string;
  onClick?: () => void;
  disableExternalNavigation?: boolean;
}

export const LinkedInPostCard: React.FC<LinkedInPostCardProps> = ({
  post,
  characterLimit = 300,
  showFullContent = false,
  highlightQueries,
  quotedPost,
  className,
  onClick,
  disableExternalNavigation = false,
}) => {
  type RawLinkedIn = {
    resharedPostContent?: {
      urn?: string;
      postID?: string;
      postURL?: string;
      text?: string;
      author?: {
        name?: string;
        headline?: string;
        url?: string;
        profilePictureURL?: string;
      };
      postedAt?: { timestamp?: number };
      engagements?: {
        totalReactions?: number;
        commentsCount?: number;
        repostsCount?: number;
      };
      mediaContent?: Array<{
        type: "image" | "video" | "article";
        url: string;
      }>;
    };
  };

  const autoQuotedPost: UnifiedPost | null = React.useMemo(() => {
    const raw = post?.raw as RawLinkedIn | undefined;
    const q = raw?.resharedPostContent;
    if (!q) return null;
    const media =
      Array.isArray(q.mediaContent) && q.mediaContent.length > 0
        ? q.mediaContent.map((m) =>
            m.type === "article"
              ? ({ type: "link", url: m.url } as const)
              : ({ type: m.type, url: m.url } as const)
          )
        : undefined;
    return {
      id: q.postID || q.urn || "",
      platform: "linkedin",
      url: q.postURL,
      author: {
        name: q.author?.name,
        headline: q.author?.headline,
        avatarUrl: q.author?.profilePictureURL,
        profileUrl: q.author?.url,
      },
      text: q.text || "",
      createdAt: q.postedAt?.timestamp || Date.now(),
      metrics: {
        reactions: q.engagements?.totalReactions ?? 0,
        comments: q.engagements?.commentsCount ?? 0,
        reposts: q.engagements?.repostsCount ?? 0,
      },
      media,
    } as UnifiedPost;
  }, [post?.raw]);

  const effectiveQuotedPost = quotedPost || autoQuotedPost;

  const ogUrl: string | null = React.useMemo(() => {
    const rawText = post?.text || "";
    const candidate = getFirstValidUrl(rawText);
    if (!candidate) return null;
    const normalized = normalizeUrl(candidate);
    return isLikelyToHaveOpenGraph(normalized) ? normalized : null;
  }, [post]);

  const handleCardActivate = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest(
      "a,button,[role=button],video,media-chrome"
    ) as HTMLElement | null;
    if (interactive && interactive !== e.currentTarget) return;
    const hasSelection =
      typeof window !== "undefined" && !!window.getSelection()?.toString();
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      hasSelection ||
      e.detail > 1
    ) {
      return;
    }
    e.stopPropagation();
    if (typeof onClick === "function") {
      onClick();
      return;
    }
    if (!disableExternalNavigation && post?.url) {
      window.open(post.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article
      className={cn(
        typeof onClick === "function" ||
          (!disableExternalNavigation && !!post?.url)
          ? "cursor-pointer"
          : "",
        className
      )}
      onClick={handleCardActivate}
      aria-label={`LinkedIn post by ${post?.author?.name || "LinkedIn user"}`}
      role="article"
    >
      {/* Left column handled inside header for consistent avatar spacing */}
      <LinkedInHeader post={post}>
        <LinkedInMenu post={post} />
      </LinkedInHeader>

      {/* Right column: content */}
      <div className="mt-2">
        <LinkedInBody
          post={post}
          characterLimit={characterLimit}
          showFullContent={showFullContent}
          highlightQueries={highlightQueries}
        />
        {/* Open Graph preview for external links (only when no media and no quote) */}
        {ogUrl &&
          !(post?.media && post.media.length > 0) &&
          !effectiveQuotedPost && (
            <div className="mt-2">
              <OpenGraphPreview
                url={ogUrl}
                context="timeline"
                debounceMs={300}
                enableCache
                retryOnError
              />
            </div>
          )}
        <LinkedInMediaGrid media={post.media} className="mt-2" />
        {effectiveQuotedPost && (
          <div className="mt-2">
            <QuoteLinkedInCard
              post={effectiveQuotedPost}
              characterLimit={characterLimit}
              showFullContent={showFullContent}
              highlightQueries={highlightQueries}
            />
          </div>
        )}
        <LinkedInFooter post={post} />
      </div>
    </article>
  );
};

export function LinkedInPostCardSkeleton() {
  return (
    <article className="w-full">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
      <div className="mt-2">
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="my-2">
        <Skeleton className="h-px w-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

