"use client";

import * as React from "react";
import type { SerializedEditorState } from "lexical";
import { PageContent } from "@/features/webapp/ui/components/page/PageContent";
import { PageHeader } from "@/features/webapp/ui/components/page/PageHeader";
import { PageLayout } from "@/features/webapp/ui/components/page/PageLayout";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { LinkedInPostCard } from "@/features/webapp/ui/components/linkedin";
import { ScrollArea } from "@/shared/ui/components/ScrollArea";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import type { UnifiedPost } from "@/shared/lib/platforms/types";

const LINKEDIN_COMMENT_TEXT_MAX = 8000;

export interface LinkedInCommentComposerPanelProps {
  post: UnifiedPost;
  prospectId?: string;
  onBack?: () => void;
}

export function LinkedInCommentComposerPanel({
  post,
  prospectId,
  onBack,
}: LinkedInCommentComposerPanelProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const [draftText, setDraftText] = React.useState(
    "Love this framing. The strongest outbound systems are the ones that keep prospect context, evidence, and messaging aligned so teams can spot quality issues early."
  );

  const handleSubmit = React.useCallback(
    async (content: SerializedEditorState) => {
      setDraftText(extractTextFromEditorState(content).trim());
    },
    []
  );

  return (
    <aside className="flex h-full min-h-0 w-full max-w-[520px] flex-1 overflow-hidden md:min-w-0">
      <PageLayout className="flex h-full max-w-[520px] flex-col md:w-full md:max-w-[520px]">
        <PageHeader title="LinkedIn comment" onBack={onBack} />
        <ScrollArea className="min-h-0 flex-1" viewportClassName="pb-6">
          <PageContent className="space-y-4 px-4 py-4">
            <LinkedInPostCard
              post={post}
              prospectId={prospectId}
              showFullContent
              readOnly
              showMenu={false}
            />

            <div className="rounded-xl border p-2">
              <BaseComposer
                currentUser={currentUser}
                initialContent={buildSerializedTextState(draftText)}
                allowedMediaKinds={["image", "gif"]}
                maxLength={LINKEDIN_COMMENT_TEXT_MAX}
                characterCountMode="raw"
                submitButtonText="Comment"
                placeholder="Write a LinkedIn comment"
                toolbarPlacement="bottom"
                showIdentityHeader={false}
                showMediaDescription={false}
                showMediaUpload
                maxAttachments={4}
                showOpenGraphPreview={false}
                toolbarConfig={{
                  showBold: false,
                  showItalic: false,
                  showEmoji: true,
                  showMedia: true,
                  showVideo: false,
                }}
                editorAreaClassName="min-h-20 text-sm"
                contentEditableClassName={DM_COMPOSER_CONTENT_EDITABLE_CLASS}
                composerPlaceholderClassName={DM_COMPOSER_PLACEHOLDER_CLASS}
                inlineAutocompleteContext={{
                  surfaceLabel: "linkedin_comment_composer",
                  platform: "linkedin",
                  prospectId,
                  maxLength: LINKEDIN_COMMENT_TEXT_MAX,
                  characterCountMode: "raw",
                }}
                className="bg-background"
                onContentChange={(content) => {
                  setDraftText(extractTextFromEditorState(content).trim());
                }}
                onSubmit={handleSubmit}
              />
            </div>
          </PageContent>
        </ScrollArea>
      </PageLayout>
    </aside>
  );
}
