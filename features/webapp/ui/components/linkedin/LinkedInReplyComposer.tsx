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
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import type { ComposerInitialMediaUpload } from "@/features/composer/types";

const LINKEDIN_COMMENT_TEXT_MAX = 8000;

export interface LinkedInReplyComposerProps {
  prospectId?: string;
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  initialMediaUploads?: ComposerInitialMediaUpload[];
  disabled?: boolean;
  submitDisabled?: boolean;
  maxAttachments?: number;
  localMentionEntities?: MentionEntitySearchResult[];
  surfaceLabel?: string;
  beforeCounterSlot?: React.ReactNode;
  onCancel?: () => void;
  onContentChange?: (content: SerializedEditorState) => void;
  onEditorFocus?: () => void;
  onEditorBlur?: () => void;
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
  initialMediaUploads,
  disabled = false,
  submitDisabled = false,
  maxAttachments = 1,
  localMentionEntities,
  surfaceLabel = "linkedin_comment_thread",
  beforeCounterSlot,
  onCancel,
  onContentChange,
  onEditorFocus,
  onEditorBlur,
  onSubmit,
}: LinkedInReplyComposerProps) {
  const { currentUser } = useViewerXComposerIdentity();
  const [draftText, setDraftText] = React.useState(initialValue);
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftText(initialValue);
    }
  }, [initialValue]);

  return (
    <div className="rounded-xl border p-2">
      <BaseComposer
        currentUser={currentUser}
        initialContent={buildSerializedTextState(draftText)}
        initialMediaUploads={initialMediaUploads}
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
        submitDisabled={submitDisabled}
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
          surfaceLabel,
          platform: "linkedin",
          prospectId,
          maxLength: LINKEDIN_COMMENT_TEXT_MAX,
          characterCountMode: "raw",
        }}
        entityMentions={{
          prospectId,
          attachmentDestination: {
            platform: "linkedin",
            surface: "comment",
          },
          remoteAllowedKinds: prospectId
            ? ["prospect", "post", "attachment"]
            : ["attachment"],
          localEntities: localMentionEntities,
          personTextMode: "label",
        }}
        className="bg-background"
        onContentChange={(content) => {
          setDraftText(extractTextFromEditorState(content).trim());
          onContentChange?.(content);
        }}
        onEditorFocus={() => {
          isFocusedRef.current = true;
          onEditorFocus?.();
        }}
        onEditorBlur={() => {
          isFocusedRef.current = false;
          onEditorBlur?.();
        }}
        onSubmit={onSubmit}
        beforeCounterSlot={beforeCounterSlot}
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
