"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils";
import {
  extractTextFromEditorState,
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
} from "@/shared/lib/utils";
import CharacterCounter from "@/shared/ui/components/CharacterCounter";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/ui/components/Avatar";
import Link from "next/link";
import { ComposerEditor } from "../../lib/ComposerEditor";
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
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { logger } from "@/shared/lib/logger";

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

  // Convex actions
  const generateUploadUrl = useMutation(
    api.mediaUploadMutations.generateUploadUrl
  );
  const processUploadedMedia = useAction(api.mediaUpload.processUploadedMedia);

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

  // Frontend media validation config aligned with X (Twitter) limits
  const ALLOWED_IMAGE_TYPES = useMemo(
    () =>
      new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
      ]),
    []
  );
  const ALLOWED_VIDEO_TYPES = useMemo(
    () => new Set(["video/mp4", "video/quicktime"]),
    []
  );
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
  const MAX_GIF_BYTES = 15 * 1024 * 1024; // 15 MB
  const MAX_VIDEO_BYTES = 512 * 1024 * 1024; // 512 MB
  const MAX_ATTACHMENTS = 4;

  const validateFile = useCallback(
    (
      file: File
    ): { ok: true; kind: "image" | "video" } | { ok: false; error: string } => {
      const type = (file.type || "").toLowerCase();

      // Type checks
      if (ALLOWED_IMAGE_TYPES.has(type)) {
        // Size checks for images
        if (type === "image/gif") {
          if (file.size > MAX_GIF_BYTES) {
            return {
              ok: false,
              error: "GIF exceeds 15 MB.",
            } as const;
          }
        } else {
          if (file.size > MAX_IMAGE_BYTES) {
            return {
              ok: false,
              error: "Image exceeds 5 MB.",
            } as const;
          }
        }
        return { ok: true, kind: "image" } as const;
      }

      if (ALLOWED_VIDEO_TYPES.has(type)) {
        if (file.size > MAX_VIDEO_BYTES) {
          return {
            ok: false,
            error: "Video exceeds 512 MB.",
          } as const;
        }
        return { ok: true, kind: "video" } as const;
      }

      return {
        ok: false,
        error: "Invalid format. Allowed: JPG, PNG, WEBP, GIF; MP4, MOV.",
      } as const;
    },
    [
      ALLOWED_IMAGE_TYPES,
      ALLOWED_VIDEO_TYPES,
      MAX_GIF_BYTES,
      MAX_IMAGE_BYTES,
      MAX_VIDEO_BYTES,
    ]
  );

  const handleMediaUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.isArray(files) ? files : Array.from(files);

      // Count current active (non-error) attachments for the 4-item cap
      const currentActiveCount = mediaUploads.filter(
        (u) => u.status !== "error"
      ).length;
      let remainingSlots = Math.max(0, MAX_ATTACHMENTS - currentActiveCount);

      // Build upload entries (some can be error entries and won't be uploaded)
      const prepared: MediaUpload[] = [];
      for (let i = 0; i < fileArray.length; i++) {
        const file: File = fileArray[i];
        const id = `upload-${Date.now()}-${i}`;
        const validation = validateFile(file);

        if (!validation.ok) {
          prepared.push({
            id,
            file,
            type: file.type.startsWith("video/") ? "video" : "image",
            progress: 0,
            status: "error",
            error: validation.error,
          });
          continue;
        }

        if (remainingSlots <= 0) {
          prepared.push({
            id,
            file,
            type: validation.kind,
            progress: 0,
            status: "error",
            error: "Maximum 4 attachments are allowed.",
          });
          continue;
        }

        remainingSlots -= 1;
        prepared.push({
          id,
          file,
          type: validation.kind,
          progress: 0,
          status: "uploading",
          url: URL.createObjectURL(file),
        });
      }

      // Replace any previous error-only entries with the new selection
      setMediaUploads((prev) => [
        ...prev.filter((u) => u.status !== "error"),
        ...prepared,
      ]);

      // Upload each valid file to the server
      for (const upload of prepared) {
        if (upload.status === "error") continue;

        try {
          // Step 1: Generate upload URL
          const uploadUrl = await generateUploadUrl();

          // Step 2: Upload file with XHR to get real progress events
          const storageIdString = await new Promise<string>(
            (resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("POST", uploadUrl);
              xhr.setRequestHeader("Content-Type", upload.file.type);

              let lastEmit = 0;
              let lastPct = -1;
              xhr.upload.onprogress = (e) => {
                if (!e.lengthComputable) return;
                const pct = Math.max(
                  1,
                  Math.min(95, Math.round((e.loaded / e.total) * 95))
                );
                const now =
                  typeof performance !== "undefined" && performance.now
                    ? performance.now()
                    : Date.now();
                if (pct === lastPct) return;
                if (now - lastEmit < 120) return; // ~8fps throttle to match counter feel
                lastEmit = now;
                lastPct = pct;
                setMediaUploads((prev) =>
                  prev.map((u) =>
                    u.id === upload.id ? { ...u, progress: pct } : u
                  )
                );
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const parsed = JSON.parse(xhr.responseText || "{}") as {
                      storageId?: string;
                    };
                    if (typeof parsed.storageId === "string") {
                      resolve(parsed.storageId);
                    } else {
                      reject(new Error("Invalid JSON from upload"));
                    }
                  } catch (err) {
                    reject(
                      err instanceof Error
                        ? err
                        : new Error("Invalid JSON from upload")
                    );
                  }
                } else {
                  reject(
                    new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`)
                  );
                }
              };
              xhr.onerror = () => {
                reject(new Error("Network error during upload"));
              };

              xhr.send(upload.file);
            }
          );

          // Step 3: While server processes metadata, gently advance 95 -> 99
          const storageId = storageIdString as Id<"_storage">;
          let localProgress = 95;
          let processingTimer: NodeJS.Timeout | null = setInterval(() => {
            localProgress = Math.min(99, localProgress + 1);
            setMediaUploads((prev) =>
              prev.map((u) =>
                u.id === upload.id ? { ...u, progress: localProgress } : u
              )
            );
            if (localProgress >= 99 && processingTimer) {
              clearInterval(processingTimer);
              processingTimer = null;
            }
          }, 120);

          const result = await processUploadedMedia({
            storageId,
            fileName: upload.file.name,
            mimeType: upload.file.type,
            size: upload.file.size,
          });

          if (processingTimer) clearInterval(processingTimer);

          // Done: mark completed
          setMediaUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? {
                    ...u,
                    status: "completed" as const,
                    progress: 100,
                    serverUrl: result.mediaUrl || undefined,
                    uploadId: result.uploadId || undefined,
                  }
                : u
            )
          );
        } catch (error) {
          logger.error("Media upload failed:", error);
          setMediaUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? {
                    ...u,
                    status: "error" as const,
                    error:
                      error instanceof Error ? error.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }
    },
    [generateUploadUrl, processUploadedMedia, mediaUploads, validateFile]
  );

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaUploads((prev) => prev.filter((upload) => upload.id !== id));
  }, []);

  const handleRemovePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleMediaChange = useCallback((newUploads: MediaUpload[]) => {
    setMediaUploads(newUploads);
  }, []);

  const handleAddDescription = useCallback(
    (mediaId: string, description: string) => {
      setMediaUploads((prev) =>
        prev.map((upload) =>
          upload.id === mediaId ? { ...upload, description } : upload
        )
      );
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const hasCompletedMedia = mediaUploads.some(
      (u) => u.status === "completed" && !!u.serverUrl
    );
    const hasContent = !!content;
    if (!hasContent && !hasCompletedMedia) return;

    setIsSubmitting(true);
    try {
      // Extract server URLs and descriptions from completed uploads
      const completedUploads = mediaUploads.filter(
        (upload) => upload.status === "completed" && upload.serverUrl
      );

      const mediaUrls = completedUploads.map((upload) => upload.serverUrl!);
      const mediaDescriptions = completedUploads.map(
        (upload) => upload.description || ""
      );

      // When posting media-only, pass an empty editor state object to satisfy typing
      const contentForSubmit = content ?? ({} as SerializedEditorState);
      await onSubmit?.(contentForSubmit, mediaUrls, mediaDescriptions);
      // Reset form
      setContent(undefined);
      setMediaUploads([]);
      // Clear editor UI selection and nodes via bridge if available
      try {
        editorAPI?.clearContent();
      } catch {}
    } catch (error) {
      logger.error("Submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isSubmitting, onSubmit, editorAPI, mediaUploads]);

  // Note: cancel flow removed in UI; keep placeholder for potential future use

  // Calculate character count
  const getCharacterCount = (
    state: SerializedEditorState | undefined
  ): number => {
    if (!state) return 0;
    // Count what will actually be posted, including newlines
    const plain = extractTextFromEditorState(state);
    return plain.length;
  };

  const characterCount = getCharacterCount(content);
  const isOverLimit = characterCount > maxLength;
  const hasText = !!content && characterCount > 0;
  const hasCompletedMedia = mediaUploads.some(
    (u) => u.status === "completed" && !!u.serverUrl
  );
  const isUploadingMedia = mediaUploads.some((u) => u.status === "uploading");
  const canSubmit =
    (hasText || hasCompletedMedia) &&
    !isOverLimit &&
    !isSubmitting &&
    !isUploadingMedia;

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
      <div className="flex items-start gap-2 py-2">
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
            <div className="flex items-center gap-1">
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
                    className="font-mono text-sm font-medium text-muted-foreground hover:underline"
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
              onAddDescription={handleAddDescription}
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
