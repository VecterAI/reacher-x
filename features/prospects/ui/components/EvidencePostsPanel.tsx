/**
 * EvidencePostsPanel
 * Sub-panel that displays evidence posts for a pain point or finance source.
 * Uses panel stack navigation - back button returns to previous panel.
 */
"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/features/webapp/ui/components";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { usePanelStack } from "../../contexts/PanelStackContext";
import { EvidencePostsList } from "./EvidencePostsList";
import { getTwitterPostId } from "@/shared/lib/twitter/contracts";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";

const EMPTY_POSTS: unknown[] = [];

export interface EvidencePostsPanelProps {
  prospectId?: string;
  /** Panel title */
  title?: string;
  /** Evidence posts to display */
  posts?: unknown[];
  /** Platform for rendering posts */
  platform?: "twitter" | "linkedin";
  /** Additional className */
  className?: string;
  onBack?: () => void;
  readOnly?: boolean;
  offline?: boolean;
}

export function EvidencePostsPanel({
  prospectId,
  title = "Evidence",
  posts = EMPTY_POSTS,
  platform = "twitter",
  className,
  onBack,
  readOnly = false,
  offline = false,
}: EvidencePostsPanelProps) {
  const { popPanel, pushPanel } = usePanelStack();

  const handlePostSelect = React.useCallback(
    (post: unknown) => {
      if (platform === "twitter") {
        const tweetId = getTwitterPostId(post);
        if (!tweetId) {
          return;
        }

        pushPanel("twitter-post", {
          tweetId,
          initialTweet: post,
        });
        return;
      }

      const linkedInPost = normalizeLinkedInPost(post);
      if (!linkedInPost?.id) {
        return;
      }

      pushPanel("linkedin-post-thread", {
        post: linkedInPost,
        prospectId,
      });
    },
    [platform, prospectId, pushPanel]
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full max-w-lg flex-1 overflow-hidden md:min-w-0",
        className
      )}
    >
      <PageLayout className="flex h-full flex-col md:w-full">
        <PageHeader title={title} onBack={onBack ?? popPanel} />
        <ScrollArea
          className="min-h-0 flex-1 overscroll-contain"
          viewportClassName="pb-6"
        >
          <PageContent>
            <EvidencePostsList
              offline={offline}
              prospectId={prospectId}
              posts={posts}
              platform={platform}
              readOnly={readOnly}
              onPostSelect={offline ? undefined : handlePostSelect}
            />
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
