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
}

export function EvidencePostsPanel({
  prospectId,
  title = "Evidence",
  posts = [],
  platform = "twitter",
  className,
  onBack,
  readOnly = false,
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
            <EvidencePostsList
              prospectId={prospectId}
              posts={posts}
              platform={platform}
              readOnly={readOnly}
            />
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
