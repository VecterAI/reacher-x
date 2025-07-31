"use client";

import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/shared/ui/components/Button";
import { BaseComposer } from "./BaseComposer";
import { NoteComposerProps } from "../../types";

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
      console.error("Note submit error:", error);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Note Header */}
      <div className="flex items-center justify-between rounded-t-lg border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {noteId ? `Note #${noteId}` : "New Note"}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Composer */}
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
        onCancel={onCancel}
        className="rounded-t-none border-t-0"
      />
    </div>
  );
}
