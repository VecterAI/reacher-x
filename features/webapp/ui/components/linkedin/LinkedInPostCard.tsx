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
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";

export interface LinkedInPostCardProps {
  post: UnifiedPost;
  prospectId?: string;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQueries?: string[];
  quotedPost?: UnifiedPost;
  className?: string;
  onClick?: () => void;
  disableExternalNavigation?: boolean;
  readOnly?: boolean;
}

export const LinkedInPostCard: React.FC<LinkedInPostCardProps> = ({
  post,
  prospectId,
  characterLimit = 300,
  showFullContent = false,
  highlightQueries,
  quotedPost,
  className,
  onClick,
  disableExternalNavigation = false,
  readOnly = false,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
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
      createdAt: q.postedAt?.timestamp || 0,
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
        "min-w-0",
        typeof onClick === "function" ||
          (!disableExternalNavigation && !!post?.url)
          ? "cursor-pointer"
          : "",
        className
      )}
      onClick={handleCardActivate}
      aria-label={`LinkedIn post by ${post?.author?.name || "LinkedIn user"}`}
      role="article"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left column handled inside header for consistent avatar spacing */}
      <LinkedInHeader post={post}>
        {!readOnly ? <LinkedInMenu post={post} /> : null}
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
        <LinkedInFooter
          post={post}
          prospectId={prospectId}
          isHovered={isHovered}
          readOnly={readOnly}
        />
      </div>
    </article>
  );
};
