"use client";

import { useState, useCallback } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import { ComposerEditor } from "../../lib/composer-editor";
import {
  ComposerEditorAPI,
  FormattingState,
} from "../../lib/ToolbarBridgePlugin";
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
  // Optional header customization
  headerPrimary?: React.ReactNode; // replaces default name/@screenName row left content
  headerSecondary?: React.ReactNode; // row below headerPrimary (e.g., Replying to ...)
  headerActionsRight?: React.ReactNode; // right-aligned actions in headerPrimary row
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
  headerPrimary,
  headerSecondary,
  headerActionsRight,
  onContentChange,
  onSubmit,
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

  // Note: cancel flow removed in UI; keep placeholder for potential future use

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

  const [formattingState, setFormattingState] = useState<FormattingState>({
    isBold: false,
    isItalic: false,
  });
  const [editorAPI, setEditorAPI] = useState<ComposerEditorAPI | null>(null);

  return (
    <div className={cn("bg-background", className)}>
      {/* Header */}
      <div className="flex items-start gap-2 p-4">
        {showAvatar && (
          <Avatar className="h-8 w-8">
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
          {/* Header Primary (left content + right actions) */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {headerPrimary ? (
                headerPrimary
              ) : (
                <>
                  <span className="text-sm font-semibold">
                    {currentUser.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    @{currentUser.screenName}
                  </span>
                </>
              )}
            </div>
            {headerActionsRight}
          </div>

          {/* Header Secondary (e.g., Replying to …) */}
          {headerSecondary && (
            <div className="mb-2 text-sm text-muted-foreground">
              {headerSecondary}
            </div>
          )}

          {/* Toolbar */}
          {showToolbar && (
            <div className="flex items-center gap-2">
              <ComposerToolbar
                config={toolbarConfig}
                onMediaUpload={handleMediaUpload}
                submitButtonText={submitButtonText}
                onSubmit={handleSubmit}
                canSubmit={!!canSubmit}
                isSubmitting={isSubmitting}
                className="flex-1"
                onBold={() => editorAPI?.toggleBold()}
                onItalic={() => editorAPI?.toggleItalic()}
                isBoldActive={formattingState.isBold}
                isItalicActive={formattingState.isItalic}
                beforeSubmitSlot={
                  showCharacterCount ? (
                    <span
                      className={cn(
                        "font-mono text-sm text-muted-foreground",
                        isOverLimit && "text-destructive"
                      )}
                    >
                      {characterCount}/{maxLength} ·
                    </span>
                  ) : undefined
                }
              />
            </div>
          )}

          {/* Editor */}
          <ComposerEditor
            placeholder={placeholder}
            maxLength={maxLength}
            showCharacterCount={false} // We'll handle this ourselves
            disabled={disabled}
            onContentChange={handleContentChange}
            onBridgeReady={(api: ComposerEditorAPI) => setEditorAPI(api)}
            onFormattingChange={(s: FormattingState) => setFormattingState(s)}
            className="min-h-[120px]"
          />
          {/* Bridge is mounted within ComposerEditor via extraPlugins */}

          {/* Media Uploads */}
          {showMediaUpload && mediaUploads.length > 0 && (
            <MediaUploadSection
              uploads={mediaUploads}
              onRemove={handleRemoveMedia}
              className="mt-4"
            />
          )}

          {/* Character Count moved to toolbar row */}
        </div>
      </div>

      {/* No footer actions per design */}
    </div>
  );
}

// no-op
