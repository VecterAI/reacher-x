"use client";

import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils";
import { BaseComposer } from "./BaseComposer";
import { NoteComposerProps } from "../../types";
import { logger } from "@/shared/lib/logger";

export function NoteComposer({
  noteId,
  currentUser,
  placeholder = "Type here...",
  maxLength = 280,
  showCharacterCount = true,
  showToolbar = true,
  showMediaUpload = true,
  disabled = false,
  className,
  onContentChange,
  onSubmit,
  onCancel,
}: NoteComposerProps) {
  const handleSubmit = async (content: SerializedEditorState) => {
    try {
      await onSubmit?.(content);
    } catch (error) {
      logger.error("Note submit error:", error);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <BaseComposer
        currentUser={currentUser}
        placeholder={placeholder}
        maxLength={maxLength}
        showCharacterCount={showCharacterCount}
        showToolbar={showToolbar}
        showMediaUpload={showMediaUpload}
        disabled={disabled}
        submitButtonText="Add"
        onContentChange={onContentChange}
        onSubmit={handleSubmit}
        headerPrimary={
          <span className="text-sm font-medium">
            {noteId ? `Note #${noteId}` : "New Note"}
          </span>
        }
        className="rounded-t-lg"
      />
    </div>
  );
}
