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
import { Tweet } from "@/features/webapp/ui/components/tweet";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

export interface EvidencePostsPanelProps {
  /** Panel title */
  title?: string;
  /** Evidence posts to display */
  posts?: unknown[];
  /** Platform for rendering posts */
  platform?: "twitter" | "linkedin";
  /** Additional className */
  className?: string;
  onBack?: () => void;
}

export function EvidencePostsPanel({
  title = "Evidence",
  posts = [],
  platform = "twitter",
  className,
  onBack,
}: EvidencePostsPanelProps) {
  const { popPanel } = usePanelStack();

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
            {posts.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No evidence posts found.
              </div>
            ) : (
              <div className="divide-y">
                {posts.map((post, index) => (
                  <div key={index} className="px-4 py-2">
                    {platform === "twitter" ? (
                      <Tweet
                        tweet={post as import("@/features/threads/types").Tweet}
                        characterLimit={280}
                        showThread={false}
                      />
                    ) : (
                      <LinkedInPostCard
                        post={post as UnifiedPost}
                        characterLimit={300}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
