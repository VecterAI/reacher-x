"use client";

import { useState, useCallback } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ComposerEditor } from "../../lib/composer-editor";
import { ComposerToolbar } from "./ComposerToolbar";
import { MediaUploadSection } from "./MediaUploadSection";
import { ComposerBaseProps, MediaUpload, ToolbarConfig } from "../../types";

interface BaseComposerProps extends ComposerBaseProps {
  currentUser: {
    name: string;
    screenName: string;
    profileImageUrl?: string;
  };
  toolbarConfig?: ToolbarConfig;
  submitButtonText?: string;
  showAvatar?: boolean;
  className?: string;
}

export function BaseComposer({
  currentUser,
  placeholder = "Type here...",
  maxLength = 280,
  showCharacterCount = true,
  showToolbar = true,

  showMediaUpload = true,
  disabled = false,
  toolbarConfig,
  submitButtonText = "Post",
  showAvatar = true,
  className,
  onContentChange,
  onSubmit,
  onCancel,
}: BaseComposerProps) {
  const [content, setContent] = useState<SerializedEditorState | undefined>(
    undefined
  );
  const [mediaUploads, setMediaUploads] = useState<MediaUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContentChange = useCallback(
    (newContent: SerializedEditorState) => {
      setContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange]
  );

  const handleMediaUpload = useCallback((files: FileList) => {
    const newUploads: MediaUpload[] = Array.from(files).map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      file,
      type: file.type.startsWith("image/") ? "image" : "video",
      progress: 0,
      status: "uploading" as const,
    }));

    setMediaUploads((prev) => [...prev, ...newUploads]);

    // Simulate upload progress
    newUploads.forEach((upload) => {
      const interval = setInterval(() => {
        setMediaUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, progress: Math.min(u.progress + 10, 100) }
              : u
          )
        );
      }, 200);

      setTimeout(() => {
        clearInterval(interval);
        setMediaUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? {
                  ...u,
                  status: "completed" as const,
                  url: URL.createObjectURL(u.file),
                }
              : u
          )
        );
      }, 2000);
    });
  }, []);

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaUploads((prev) => prev.filter((upload) => upload.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.(content);
      // Reset form
      setContent(undefined);
      setMediaUploads([]);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isSubmitting, onSubmit]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    setContent(undefined);
    setMediaUploads([]);
  }, [onCancel]);

  // Calculate character count
  const getCharacterCount = (
    state: SerializedEditorState | undefined
  ): number => {
    if (!state) return 0;
    let count = 0;
    const traverse = (node: Record<string, unknown>) => {
      if (typeof node.text === "string") {
        count += node.text.length;
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    traverse(state.root);
    return count;
  };

  const characterCount = getCharacterCount(content);
  const isOverLimit = characterCount > maxLength;
  const canSubmit =
    content && characterCount > 0 && !isOverLimit && !isSubmitting;

  return (
    <div className={cn("bg-background", className)}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {showAvatar && (
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={currentUser.profileImageUrl}
              alt={currentUser.name}
            />
            <AvatarFallback>
              {currentUser.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          {/* User Info */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">{currentUser.name}</span>
            <span className="text-sm text-muted-foreground">
              @{currentUser.screenName}
            </span>
          </div>

          {/* Toolbar */}
          {showToolbar && (
            <ComposerToolbar
              config={toolbarConfig}
              onMediaUpload={handleMediaUpload}
              className="border-t"
            />
          )}

          {/* Editor */}
          <ComposerEditor
            placeholder={placeholder}
            maxLength={maxLength}
            showCharacterCount={false} // We'll handle this ourselves
            disabled={disabled}
            onContentChange={handleContentChange}
            className="min-h-[120px]"
          />

          {/* Media Uploads */}
          {showMediaUpload && mediaUploads.length > 0 && (
            <MediaUploadSection
              uploads={mediaUploads}
              onRemove={handleRemoveMedia}
              className="mt-4"
            />
          )}

          {/* Character Count */}
          {showCharacterCount && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className={cn(isOverLimit && "text-destructive")}>
                {characterCount}/{maxLength}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t p-4">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={!canSubmit} className="px-6">
            {isSubmitting ? "Posting..." : submitButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
