"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SerializedEditorState } from "lexical";
import { cn } from "@/shared/lib/utils";
import {
  extractTextFromEditorState,
  getFirstValidUrl,
  isLikelyToHaveOpenGraph,
} from "@/shared/lib/utils";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
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
import {
  ComposerBaseProps,
  ComposerIdentityUser,
  MediaUpload,
  ToolbarConfig,
} from "../../types";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import { getXPostWeightedLength } from "@/shared/lib/twitter/xPostTextLimit";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { logger } from "@/shared/lib/logger";

function areMediaUploadsEqual(a: MediaUpload[], b: MediaUpload[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];

    if (
      left.id !== right.id ||
      left.type !== right.type ||
      left.progress !== right.progress ||
      left.status !== right.status ||
      left.error !== right.error ||
      left.description !== right.description ||
      left.url !== right.url ||
      left.serverUrl !== right.serverUrl ||
      left.uploadId !== right.uploadId ||
      left.file !== right.file
    ) {
      return false;
    }
  }

  return true;
}

interface BaseComposerProps extends ComposerBaseProps {
  currentUser: ComposerIdentityUser;
  toolbarConfig?: ToolbarConfig;
  submitButtonText?: string;
  /** Text label vs DM-style up-arrow control. */
  submitButtonVariant?: "text" | "icon";
  /** Action row above (default) or below the editor (DM layout). */
  toolbarPlacement?: "top" | "bottom";
  /** When false, hide avatar + name row (e.g. X DM inline composer). */
  showIdentityHeader?: boolean;
  showAvatar?: boolean;
  className?: string;
  /** Applied to the Lexical editor shell (e.g. min-height to match PromptInput). */
  editorAreaClassName?: string;
  // Optional header customization
  headerPrimary?: React.ReactNode; // replaces default name/@screenName row left content
  headerSecondary?: React.ReactNode; // row below headerPrimary (e.g., Replying to ...)
  headerActionsRight?: React.ReactNode; // right-aligned actions in headerPrimary row
  /** Passed to toolbar: after emoji (e.g. draft save indicator). */
  afterEmojiSlot?: React.ReactNode;
  /** Passed to toolbar: immediately before submit, after char count (e.g. cancel draft). */
  submitToolbarStart?: React.ReactNode;
}

export function BaseComposer({
  currentUser,
  initialContent,
  placeholder = "Type here...",
  maxLength = 280,
  characterCountMode = "x_post",
  showCharacterCount = true,
  showToolbar = true,

  showMediaUpload = true,
  maxAttachments = 4,
  disabled = false,
  toolbarConfig,
  submitButtonText = "Post",
  submitButtonVariant = "text",
  toolbarPlacement = "top",
  showIdentityHeader = true,
  showAvatar = true,
  className,
  editorAreaClassName,
  contentEditableClassName,
  composerPlaceholderClassName,
  headerPrimary,
  headerSecondary,
  headerActionsRight,
  afterEmojiSlot,
  submitToolbarStart,
  onContentChange,
  onSubmit,
  onEditorBlur,
  onEditorFocus,
}: BaseComposerProps) {
  const [content, setContent] = useState<SerializedEditorState | undefined>(
    initialContent
  );
  const [mediaUploads, setMediaUploads] = useState<MediaUpload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editorAPI, setEditorAPI] = useState<ComposerEditorAPI | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const serializedInitialContent = useMemo(
    () => JSON.stringify(initialContent ?? null),
    [initialContent]
  );
  const prevInitialSerializedRef = useRef<string>(serializedInitialContent);

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

  // Sync from parent `initialContent` only when that value changes (e.g. draft load).
  // Do not reset on blur when the user has diverged from the last parent value — that
  // broke emoji picker (focus moves to the popover) and any other portaled control.
  useEffect(() => {
    if (serializedInitialContent === prevInitialSerializedRef.current) {
      return;
    }
    prevInitialSerializedRef.current = serializedInitialContent;
    if (isComposerFocused) {
      return;
    }
    setContent(initialContent);
    editorAPI?.replaceContent(
      initialContent ? extractTextFromEditorState(initialContent) : undefined
    );
  }, [editorAPI, initialContent, isComposerFocused, serializedInitialContent]);

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
  const MAX_ATTACHMENTS = maxAttachments;

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
        const id = `upload-${getCurrentUTCTimestamp()}-${i}`;
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
                    : getCurrentUTCTimestamp();
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
    [
      generateUploadUrl,
      MAX_ATTACHMENTS,
      processUploadedMedia,
      mediaUploads,
      validateFile,
    ]
  );

  const handleRemoveMedia = useCallback((id: string) => {
    setMediaUploads((prev) => prev.filter((upload) => upload.id !== id));
  }, []);

  const handleRemovePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleMediaChange = useCallback((newUploads: MediaUpload[]) => {
    setMediaUploads((prev) =>
      areMediaUploadsEqual(prev, newUploads) ? prev : newUploads
    );
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

  const characterCount = useMemo(() => {
    if (!content) return 0;
    const plain = extractTextFromEditorState(content);
    return characterCountMode === "x_post"
      ? getXPostWeightedLength(plain)
      : plain.length;
  }, [content, characterCountMode]);
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

  const toolbarRow = showToolbar && (
    <div
      className={cn(
        "flex items-center gap-2",
        toolbarPlacement === "bottom" && "mt-1 pt-1"
      )}
    >
      <ComposerToolbar
        config={toolbarConfig}
        onMediaUpload={handleMediaUpload}
        onEmojiSelect={handleEmojiSelect}
        submitButtonText={submitButtonText}
        submitButtonVariant={submitButtonVariant}
        onSubmit={handleSubmit}
        canSubmit={!!canSubmit}
        isSubmitting={isSubmitting}
        interactionDisabled={disabled}
        className="flex-1"
        onBold={handleBold}
        onItalic={handleItalic}
        isBoldActive={formattingState.isBold}
        isItalicActive={formattingState.isItalic}
        afterEmojiSlot={afterEmojiSlot}
        submitToolbarStart={submitToolbarStart}
        beforeSubmitSlot={
          showCharacterCount ? (
            <div className="flex items-center gap-1.5">
              <CharacterCounter current={characterCount} max={maxLength} />
              <span className="text-muted-foreground">·</span>
            </div>
          ) : undefined
        }
      />
    </div>
  );

  const editorBlock = (
    <div className={cn("relative min-w-0", editorAreaClassName)}>
      <ComposerEditor
        initialContent={initialContent}
        placeholder={placeholder}
        maxLength={maxLength}
        characterCountMode={characterCountMode}
        showCharacterCount={false}
        disabled={disabled}
        contentEditableClassName={contentEditableClassName}
        composerPlaceholderClassName={composerPlaceholderClassName}
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
    </div>
  );

  const mediaBlock =
    showMediaUpload && mediaUploads.length > 0 ? (
      <MediaUploadSection
        uploads={mediaUploads}
        onRemove={handleRemoveMedia}
        onAddDescription={handleAddDescription}
        className={toolbarPlacement === "bottom" ? "mt-3" : "mt-4"}
      />
    ) : null;

  const ogBlock = previewUrl ? (
    <OpenGraphPreview
      url={previewUrl}
      onRemove={handleRemovePreview}
      className="mt-3"
    />
  ) : null;

  return (
    <div
      className={cn("bg-background", className)}
      onFocusCapture={() => {
        if (!isComposerFocused) {
          setIsComposerFocused(true);
          onEditorFocus?.();
        }
      }}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsComposerFocused(false);
        onEditorBlur?.();
      }}
    >
      {/* Header + body */}
      <div
        className={cn(
          "flex items-start gap-2",
          showIdentityHeader ? "py-2" : "py-0"
        )}
      >
        {showIdentityHeader && showAvatar && (
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
          {showIdentityHeader ? (
            <>
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
                      {currentUser.verified && (
                        <NewReleasesIcon
                          className="size-3 shrink-0 fill-current"
                          aria-hidden="true"
                          data-testid="composer-verified-badge"
                        />
                      )}
                      <Link
                        href={`https://x.com/${currentUser.screenName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground font-mono text-sm font-medium hover:underline"
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
                <div className="text-muted-foreground mb-2 text-sm">
                  {headerSecondary}
                </div>
              )}
            </>
          ) : null}

          {toolbarPlacement === "top" ? (
            <>
              {toolbarRow}
              {editorBlock}
              {mediaBlock}
              {ogBlock}
            </>
          ) : (
            <>
              {editorBlock}
              {mediaBlock}
              {ogBlock}
              {toolbarRow}
            </>
          )}
        </div>
      </div>

      {/* No footer actions per design */}
    </div>
  );
}

// no-op
