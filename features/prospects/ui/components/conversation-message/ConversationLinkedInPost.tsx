"use client";

import * as React from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuoteLinkedInCard } from "@/features/webapp/ui/components/linkedin/QuoteLinkedInCard";
import { QuoteLinkedInCardSkeleton } from "@/features/webapp/ui/components/linkedin/QuoteLinkedInCardSkeleton";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import { MediaUnavailablePlaceholder } from "@/shared/ui/components/MediaUnavailablePlaceholder";

interface ConversationLinkedInPostProps {
  prospectId: string;
  postUrl: string;
}

const previewCache = new Map<string, UnifiedPost>();
const previewRequests = new Map<string, Promise<UnifiedPost | null>>();

export function ConversationLinkedInPost({
  prospectId,
  postUrl,
}: ConversationLinkedInPostProps) {
  const getPostPreview = useAction(api.linkedin.getLinkedInDmPostPreview);
  const cacheKey = JSON.stringify([prospectId, postUrl]);
  const [post, setPost] = React.useState<UnifiedPost | null | undefined>(() =>
    previewCache.get(cacheKey)
  );

  React.useEffect(() => {
    const cached = previewCache.get(cacheKey);
    if (cached !== undefined) {
      setPost(cached);
      return;
    }

    let active = true;
    let request = previewRequests.get(cacheKey);
    if (!request) {
      request = getPostPreview({
        prospectId: prospectId as Id<"prospects">,
        postUrl,
      });
      previewRequests.set(cacheKey, request);
      const clearRequest = () => {
        if (previewRequests.get(cacheKey) === request) {
          previewRequests.delete(cacheKey);
        }
      };
      void request.then(clearRequest, clearRequest);
    }

    void request
      .then((result) => {
        if (result) previewCache.set(cacheKey, result);
        if (active) setPost(result);
      })
      .catch(() => {
        if (active) setPost(null);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, getPostPreview, postUrl, prospectId]);

  if (post) {
    return (
      <QuoteLinkedInCard
        post={post}
        prospectId={prospectId}
        className="bg-background"
      />
    );
  }

  if (post === null) {
    return (
      <MediaUnavailablePlaceholder
        title="LinkedIn post unavailable"
        aspectRatio={16 / 9}
      />
    );
  }

  return <QuoteLinkedInCardSkeleton />;
}
