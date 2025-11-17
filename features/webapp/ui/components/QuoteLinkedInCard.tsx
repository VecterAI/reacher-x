// features/webapp/ui/components/QuoteLinkedInCard.tsx
"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { cn } from "@/shared/lib/utils/utils";
import { LinkedInHeader } from "./LinkedInHeader";
import { LinkedInMenu } from "./LinkedInMenu";
import { LinkedInBody } from "./LinkedInBody";
import { LinkedInMediaGrid } from "./LinkedInMediaGrid";
import { Skeleton } from "@/shared/ui/components/Skeleton";
import { OpenGraphPreview } from "@/features/composer/ui/components/OpenGraphPreview";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import { base64UrlEncodeUtf8 } from "@/shared/lib/utils/encoding";
import { cacheLinkedInPost } from "@/shared/lib/utils/linkedinPostCache";
import {
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
  normalizeUrl,
} from "@/shared/lib/utils/urlDetection";

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
  const [keywordIdParam] = useQueryState("keywordId", parseAsString);
  const [queryParam] = useQueryState("q", parseAsString);
  const [exactParam] = useQueryState("exact", parseAsBoolean);
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
    try {
      cacheLinkedInPost(id, post);
    } catch {}
    let packed = "";
    try {
      packed = base64UrlEncodeUtf8(JSON.stringify(post));
    } catch {}
    const params = new URLSearchParams();
    if (packed) params.set("t", packed);
    if (keywordIdParam) params.set("keywordId", keywordIdParam);
    if (queryParam) params.set("q", queryParam);
    if (typeof exactParam === "boolean")
      params.set("exact", exactParam ? "true" : "false");
    const url = `/post/linkedin/${id}?${params.toString()}`;
    router.push(url, { scroll: false });
  };
  return (
    <div
      className={cn(
        "group block w-full cursor-pointer rounded-xl border p-2 transition-colors hover:bg-muted/50",
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

export function QuoteLinkedInCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card/30 p-2">
      <div className="mb-1 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
      <div className="mt-2">
        <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      </div>
    </div>
  );
}
