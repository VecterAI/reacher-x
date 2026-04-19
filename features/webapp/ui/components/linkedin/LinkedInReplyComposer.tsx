"use client";

import * as React from "react";
import type { SerializedEditorState } from "lexical";
import { BaseComposer } from "@/features/composer/ui/components/BaseComposer";
import { useViewerXComposerIdentity } from "@/features/composer/hooks/useViewerXComposerIdentity";
import { buildSerializedTextState } from "@/features/composer/lib/buildSerializedTextState";
import {
  DM_COMPOSER_CONTENT_EDITABLE_CLASS,
  DM_COMPOSER_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { extractTextFromEditorState } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";

const LINKEDIN_COMMENT_TEXT_MAX = 8000;

export interface LinkedInReplyComposerProps {
  prospectId?: string;
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  disabled?: boolean;
  maxAttachments?: number;
  onCancel?: () => void;
  onSubmit: (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[]
  ) => void | Promise<void>;
}

export function LinkedInReplyComposer({
  prospectId,
  placeholder,
  submitLabel,
  initialValue = "",
  disabled = false,
  maxAttachments = 1,
  onCancel,
  onSubmit,
}: LinkedInReplyComposerProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const [draftText, setDraftText] = React.useState(initialValue);

  return (
    <div className="rounded-xl border p-2">
      <BaseComposer
        currentUser={currentUser}
        initialContent={buildSerializedTextState(draftText)}
        allowedMediaKinds={["image"]}
        maxLength={LINKEDIN_COMMENT_TEXT_MAX}
        characterCountMode="raw"
        submitButtonText={submitLabel}
        placeholder={placeholder}
        toolbarPlacement="bottom"
        showIdentityHeader={false}
        showMediaDescription={false}
        showMediaUpload
        maxAttachments={maxAttachments}
        showOpenGraphPreview={false}
        disabled={disabled}
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
          surfaceLabel: "linkedin_comment_thread",
          platform: "linkedin",
          prospectId,
          maxLength: LINKEDIN_COMMENT_TEXT_MAX,
          characterCountMode: "raw",
        }}
        className="bg-background"
        onContentChange={(content) => {
          setDraftText(extractTextFromEditorState(content).trim());
        }}
        onSubmit={onSubmit}
        submitToolbarStart={
          onCancel ? (
            <Button variant="ghost" size="xs" type="button" onClick={onCancel}>
              Cancel
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
