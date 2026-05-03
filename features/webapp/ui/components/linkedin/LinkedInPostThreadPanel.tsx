"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { LinkedInPostCard } from "./LinkedInPostCard";
import {
  LinkedInCommentThread,
  type LinkedInCommentThreadPreviewScenario,
} from "./LinkedInCommentThread";

export interface LinkedInPostThreadPanelProps {
  post: UnifiedPost;
  prospectId?: string;
  onBack?: () => void;
  previewScenario?: LinkedInCommentThreadPreviewScenario;
}

export function LinkedInPostThreadPanel({
  post,
  prospectId,
  onBack,
  previewScenario,
}: LinkedInPostThreadPanelProps) {
  const [resolvedPostsById, setResolvedPostsById] = React.useState<
    Record<string, UnifiedPost>
  >({});
  const resolvedPost = resolvedPostsById[post.id] ?? post;

  const handleResolvedPost = React.useCallback(
    (nextPost: UnifiedPost) => {
      setResolvedPostsById((current) => {
        if (current[post.id] === nextPost) {
          return current;
        }
        return {
          ...current,
          [post.id]: nextPost,
        };
      });
    },
    [post.id]
  );

  return (
    <PageLayout className="flex flex-col">
      <PageHeader title="Post" onBack={onBack} />
      <ScrollArea className="min-h-0 flex-1">
        <PageContent className="mx-4 mt-4 space-y-2 pb-4">
          <LinkedInPostCard
            post={resolvedPost}
            prospectId={prospectId}
            showFullContent
            disableExternalNavigation
            openBehavior="none"
            commentBehavior="none"
            showFooter
          />
          <LinkedInCommentThread
            post={post}
            prospectId={prospectId}
            previewScenario={previewScenario}
            onResolvedPost={handleResolvedPost}
          />
        </PageContent>
      </ScrollArea>
    </PageLayout>
  );
}
