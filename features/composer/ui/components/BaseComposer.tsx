"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils/utils";
import {
  extractTextFromEditorState,
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
} from "@/shared/lib/utils/urlDetection";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import Link from "next/link";
import { ComposerEditor } from "../../lib/composer-editor";
import {
  ComposerEditorAPI,
  FormattingState,
} from "../../lib/ToolbarBridgePlugin";
import { ComposerToolbar } from "./ComposerToolbar";
import { MediaUploadSection } from "./MediaUploadSection";
import { OpenGraphPreview } from "./OpenGraphPreview";
import { MediaRenderPlugin } from "./MediaRenderPlugin";
import { MediaPastePlugin } from "./MediaPastePlugin";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editorAPI, setEditorAPI] = useState<ComposerEditorAPI | null>(null);

  const handleContentChange = useCallback(
    (newContent: SerializedEditorState) => {
      setContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange]
  );

  // Detect first valid URL in text content to preview OG card
  const firstUrl = useMemo(() => {
    if (!content) return null;

    const text = extractTextFromEditorState(content);
    const url = getFirstValidUrl(text);

    // Only show preview for URLs likely to have Open Graph data
    return url && isLikelyToHaveOpenGraph(url) ? url : null;
  }, [content]);

  // Update preview URL when content changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPreviewUrl(firstUrl);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [firstUrl]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (editorAPI) {
        editorAPI.insertEmoji(emoji);
      }
    },
    [editorAPI]
  );

  const handleBridgeReady = useCallback((api: ComposerEditorAPI) => {
    setEditorAPI(api);
  }, []);

  const handleMediaUpload = useCallback((files: FileList | File[]) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files);
    const newUploads: MediaUpload[] = fileArray.map((file, index) => ({
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

  const handleRemovePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleMediaChange = useCallback((newUploads: MediaUpload[]) => {
    setMediaUploads(newUploads);
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
    ((content && characterCount > 0) || mediaUploads.length > 0) &&
    !isOverLimit &&
    !isSubmitting;

  const [formattingState, setFormattingState] = useState<FormattingState>({
    isBold: false,
    isItalic: false,
  });

  const handleFormattingChange = useCallback((state: FormattingState) => {
    setFormattingState(state);
  }, []);

  const handleBold = useCallback(() => {
    editorAPI?.toggleBold();
  }, [editorAPI]);

  const handleItalic = useCallback(() => {
    editorAPI?.toggleItalic();
  }, [editorAPI]);

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
                  <Link
                    href={`https://x.com/${currentUser.screenName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View ${currentUser.name}'s profile`}
                  >
                    {currentUser.name}
                  </Link>
                  <Link
                    href={`https://x.com/${currentUser.screenName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`View @${currentUser.screenName}'s profile`}
                  >
                    @{currentUser.screenName}
                  </Link>
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
                onEmojiSelect={handleEmojiSelect}
                submitButtonText={submitButtonText}
                onSubmit={handleSubmit}
                canSubmit={!!canSubmit}
                isSubmitting={isSubmitting}
                className="flex-1"
                onBold={handleBold}
                onItalic={handleItalic}
                isBoldActive={formattingState.isBold}
                isItalicActive={formattingState.isItalic}
                beforeSubmitSlot={
                  showCharacterCount ? (
                    <div className="flex items-center gap-1.5">
                      <CharacterCounter
                        current={characterCount}
                        max={maxLength}
                      />
                      <span className="text-muted-foreground">·</span>
                    </div>
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
            onBridgeReady={handleBridgeReady}
            onFormattingChange={handleFormattingChange}
            extraPlugins={
              <>
                <MediaPastePlugin onMediaUpload={handleMediaUpload} />
                <MediaRenderPlugin
                  onMediaChange={handleMediaChange}
                  existingUploads={mediaUploads}
                />
              </>
            }
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

          {/* Open Graph Preview */}
          {previewUrl && (
            <OpenGraphPreview
              url={previewUrl}
              onRemove={handleRemovePreview}
              className="mt-3"
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
