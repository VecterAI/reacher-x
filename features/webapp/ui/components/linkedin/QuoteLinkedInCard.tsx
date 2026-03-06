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
import { useRouter } from "next/navigation";
import { base64UrlEncodeUtf8 } from "@/shared/lib/utils";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils";

export interface QuoteLinkedInCardProps {
  post: UnifiedPost;
  characterLimit?: number;
  showFullContent?: boolean;
  highlightQueries?: string[];
  className?: string;
}

export const QuoteLinkedInCard: React.FC<QuoteLinkedInCardProps> = ({
  post,
  characterLimit = 300,
  showFullContent = false,
  highlightQueries,
  className,
}) => {
  const router = useRouter();
  const ogUrl: string | null = React.useMemo(() => {
    const rawText = post?.text || "";
    const candidate = getFirstValidUrl(rawText);
    if (!candidate) return null;
    const normalized = normalizeUrl(candidate);
    return isLikelyToHaveOpenGraph(normalized) ? normalized : null;
  }, [post]);

  const handleNavigate = (e: React.MouseEvent<HTMLDivElement>) => {
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
    const id = String(post?.id || "");
    if (!id) return;
    let packed = "";
    try {
      packed = base64UrlEncodeUtf8(JSON.stringify(post));
    } catch {}
    const params = new URLSearchParams();
    if (packed) params.set("t", packed);
    const url = `/post/linkedin/${id}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(url, { scroll: false });
  };
  return (
    <div
      className={cn(
        "group hover:bg-muted/50 block w-full min-w-0 cursor-pointer rounded-xl border p-2 transition-colors",
        className
      )}
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const synthetic = {
            ...e,
            target: e.target as EventTarget & HTMLElement,
            currentTarget: e.currentTarget as EventTarget & HTMLDivElement,
            stopPropagation: () => {},
          } as unknown as React.MouseEvent<HTMLDivElement>;
          handleNavigate(synthetic);
        }
      }}
      aria-label={`View LinkedIn post by ${post?.author?.name || "LinkedIn user"}`}
    >
      <LinkedInHeader post={post}>
        <LinkedInMenu post={post} />
      </LinkedInHeader>
      <LinkedInBody
        post={post}
        characterLimit={characterLimit}
        showFullContent={showFullContent}
        highlightQueries={highlightQueries}
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
