// features/webapp/ui/components/linkedin/QuoteLinkedInCard.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils";
import { LinkedInHeader } from "./LinkedInHeader";
import { LinkedInMenu } from "./LinkedInMenu";
import { LinkedInBody } from "./LinkedInBody";
import { LinkedInMediaGrid } from "./LinkedInMediaGrid";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";
import {
  shouldIgnorePostCardClick,
  shouldIgnorePostCardKeyDown,
} from "@/features/webapp/lib/postNavigation";
import { buildLinkedInAuthorIdentity } from "@/shared/lib/linkedin/identity";
import { useLinkedInProfileNavigation } from "./useLinkedInProfileNavigation";
import { usePostNavigation } from "@/features/webapp/hooks/usePostNavigation";

export interface QuoteLinkedInCardProps {
  post: UnifiedPost;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQueries?: string[];
  className?: string;
  prospectId?: string;
}

export const QuoteLinkedInCard: React.FC<QuoteLinkedInCardProps> = ({
  post,
  characterLimit = 300,
  showFullContent = false,
  highlightQueries,
  className,
  prospectId,
}) => {
  const { hasPanelStack, openLinkedInPost } = usePostNavigation();
  const openLinkedInProfile = useLinkedInProfileNavigation();
  const authorIdentity = React.useMemo(
    () => buildLinkedInAuthorIdentity(post.author),
    [post.author]
  );
  const ogUrl: string | null = React.useMemo(() => {
    const rawText = post?.text || "";
    const candidate = getFirstValidUrl(rawText);
    if (!candidate) return null;
    const normalized = normalizeUrl(candidate);
    return isLikelyToHaveOpenGraph(normalized) ? normalized : null;
  }, [post]);

  const handleNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldIgnorePostCardClick(e)) return;
    e.stopPropagation();
    openLinkedInPost(post, hasPanelStack ? "panel" : "route", prospectId);
  };
  return (
    <div
      className={cn(
        "group block w-full min-w-0 cursor-pointer rounded-xl border p-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900",
        className
      )}
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (shouldIgnorePostCardKeyDown(e)) return;
        e.preventDefault();
        e.stopPropagation();
        openLinkedInPost(post, hasPanelStack ? "panel" : "route", prospectId);
      }}
      aria-label={`View LinkedIn post by ${post?.author?.name || "LinkedIn user"}`}
    >
      <LinkedInHeader
        post={post}
        disableProfileNavigation={!authorIdentity}
        profileIdentity={authorIdentity}
        onOpenProfile={(identity) => openLinkedInProfile(identity, prospectId)}
      >
        <LinkedInMenu post={post} />
      </LinkedInHeader>
      <LinkedInBody
        post={post}
        characterLimit={characterLimit}
        showFullContent={showFullContent}
        highlightQueries={highlightQueries}
        onOpenProfile={(identity) => openLinkedInProfile(identity)}
        className="mt-1"
      />
      {/* Open Graph preview for external links (only when no media) */}
      {ogUrl && !(post?.media && post.media.length > 0) && (
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
    </div>
  );
};
