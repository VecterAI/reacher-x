"use client";

import * as React from "react";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
import {
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/webapp/ui/components";
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
  return (
    <PageLayout>
      <PageHeader title="Post" onBack={onBack} />
      <PageContent className="mx-4 mt-4 space-y-2 pb-4">
        <LinkedInPostCard
          post={post}
          prospectId={prospectId}
          showFullContent
          disableExternalNavigation
          commentBehavior="none"
          showFooter
        />
        <LinkedInCommentThread
          post={post}
          prospectId={prospectId}
          previewScenario={previewScenario}
        />
      </PageContent>
    </PageLayout>
  );
}
