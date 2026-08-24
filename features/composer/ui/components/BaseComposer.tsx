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
import {
  LINKEDIN_MESSAGE_DOCUMENT_ACCEPT,
  LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES,
  isLinkedInVoiceMessageMimeType,
} from "@/shared/lib/utils/media/linkedinMessageAttachmentTypes";
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
  ComposerAttachmentDestination,
  ComposerEntityMentionsConfig,
  ComposerInitialMediaUpload,
  ComposerIdentityUser,
  ComposerMediaKind,
  MediaUpload,
  ToolbarConfig,
} from "../../types";
import { NewReleasesIcon } from "@/shared/ui/components/icons";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { getXPostWeightedLength } from "@/shared/lib/twitter/xPostTextLimit";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS,
  COMPOSER_PREVIEW_PLACEHOLDER_CLASS,
} from "@/features/composer/ui/dmComposerClasses";
import { buildInitialMediaUploadFromMentionEntity } from "../../lib/entityMentions";
import {
  readBrowserMediaMetadata,
  withBrowserMediaMetadata,
} from "../../lib/browserMediaMetadata";
import { useWorkspace } from "@/shared/hooks";
import {
  useVoiceNoteRecorder,
  type VoiceNotePlatform,
} from "../../hooks/useVoiceNoteRecorder";
import { VoiceNoteComposer, VoiceNoteTrigger } from "./voice-note-composer";

function areMediaUploadsEqual(a: MediaUpload[], b: MediaUpload[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];

    if (
      left.id !== right.id ||
      left.type !== right.type ||
      left.mediaKind !== right.mediaKind ||
      left.size !== right.size ||
      left.width !== right.width ||
      left.height !== right.height ||
      left.durationMs !== right.durationMs ||
      left.isVoiceNote !== right.isVoiceNote ||
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

function revokeComposerObjectUrl(url?: string) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function getAttachmentLimitError(maxAttachments: number): string {
  return maxAttachments === 1
    ? "Only one attachment is allowed."
    : `Maximum ${maxAttachments} attachments are allowed.`;
}

function inferMediaKindFromMimeType(
  mimeType: string | undefined
): ComposerMediaKind {
  const normalized = mimeType?.toLowerCase() ?? "";
  if (normalized === "image/gif") {
    return "gif";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  if (
    LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES.has(normalized) ||
    isLinkedInVoiceMessageMimeType(normalized)
  ) {
    return "file";
  }
  return "image";
}

function getComposerSelectionError(
  currentKinds: ComposerMediaKind[],
  nextKind: ComposerMediaKind,
  destination?: ComposerAttachmentDestination,
  currentBytes = 0,
  nextBytes = 0
): string | null {
  if (destination?.platform === "linkedin" && destination.surface === "dm") {
    if (currentBytes + nextBytes > 20 * 1024 * 1024) {
      return "LinkedIn DMs allow up to 20 MB total across all attachments.";
    }
    return null;
  }
  const nextKinds = [...currentKinds, nextKind];
  const gifCount = nextKinds.filter((kind) => kind === "gif").length;
  const videoCount = nextKinds.filter((kind) => kind === "video").length;
  const imageCount = nextKinds.filter((kind) => kind === "image").length;

  if (gifCount > 1) {
    return "Only one GIF can be attached.";
  }
  if (videoCount > 1) {
    return "Only one video can be attached.";
  }
  if (gifCount + videoCount > 1) {
    return "Choose either one GIF or one video.";
  }
  if (gifCount + videoCount > 0 && imageCount > 0) {
    return "Photos cannot be mixed with a GIF or video.";
  }

  return null;
}

function buildInitialMediaUpload(
  attachment: ComposerInitialMediaUpload
): MediaUpload {
  const mediaKind =
    attachment.mediaKind ??
    (attachment.type === "video"
      ? "video"
      : attachment.type === "file"
        ? "file"
        : "image");
  const fallbackFileName =
    attachment.type === "video"
      ? `${attachment.id}.mp4`
      : attachment.type === "file"
        ? `${attachment.id}.pdf`
        : `${attachment.id}.png`;
  return {
    id: attachment.id,
    file: new File([], attachment.fileName ?? fallbackFileName, {
      type:
        attachment.mimeType ??
        (mediaKind === "gif"
          ? "image/gif"
          : attachment.type === "video"
            ? "video/mp4"
            : attachment.type === "file"
              ? "application/pdf"
              : "image/png"),
    }),
    url: attachment.url ?? attachment.serverUrl,
    serverUrl: attachment.serverUrl ?? attachment.url,
    uploadId: attachment.uploadId,
    type: attachment.type,
    mediaKind,
    size: attachment.size,
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.durationMs,
    progress: 100,
    status: "completed",
    description: attachment.description,
  };
}

interface BaseComposerProps extends ComposerBaseProps {
  currentUser: ComposerIdentityUser;
  toolbarConfig?: ToolbarConfig;
  submitButtonText?: string;
  /** Text label vs DM-style up-arrow control. */
  submitButtonVariant?: "text" | "icon";
  /** Enter submits; Shift+Enter keeps its native newline behavior. */
  submitOnEnter?: boolean;
  /** Reset immediately after accepting durable work instead of awaiting it. */
  submitMode?: "confirmed" | "optimistic";
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
  /** Composes a provider-specific media control with the shared upload path. */
  renderMediaControl?: (controls: {
    addFiles: (files: File[]) => Promise<void>;
    disabled: boolean;
  }) => React.ReactNode;
  /** Passed to toolbar: immediately before the character counter. */
  beforeCounterSlot?: React.ReactNode;
  /** Passed to toolbar: immediately before submit, after char count (e.g. cancel draft). */
  submitToolbarStart?: React.ReactNode;
  /** When false, hide alt/description UI on media (e.g. X DMs have no media descriptions). Default true. */
  showMediaDescription?: boolean;
  /** When true, keep editing enabled but disable submit affordance. */
  submitDisabled?: boolean;
  /** Keep selected files in browser memory for an encrypted submit flow. */
  deferMediaUpload?: boolean;
  /** Enables the shared, local-first voice-note recording flow. */
  voiceNotePlatform?: VoiceNotePlatform;
}

export function BaseComposer({
  currentUser,
  initialContent,
  initialMediaUploads,
  allowedMediaKinds = ["image", "gif", "video"],
  placeholder = "Type here...",
  maxLength = 280,
  characterCountMode = "x_post",
  showCharacterCount = true,
  showToolbar = true,

  showMediaUpload = true,
  maxAttachments = 4,
  disabled = false,
  previewMode = false,
  toolbarConfig,
  submitButtonText = "Post",
  submitButtonVariant = "text",
  submitOnEnter = false,
  submitMode = "confirmed",
  toolbarPlacement = "top",
  showIdentityHeader = true,
  showAvatar = true,
  className,
  editorAreaClassName,
  contentEditableClassName,
  composerPlaceholderClassName,
  showOpenGraphPreview = true,
  inlineAutocompleteContext,
  enableEntityMentions = false,
  entityMentions,
  headerPrimary,
  headerSecondary,
  headerActionsRight,
  afterEmojiSlot,
  renderMediaControl,
  beforeCounterSlot,
  submitToolbarStart,
  showMediaDescription = true,
  submitDisabled = false,
  deferMediaUpload = false,
  voiceNotePlatform,
  onContentChange,
  onSubmit,
  onEditorBlur,
  onEditorFocus,
}: BaseComposerProps) {
  const { workspace } = useWorkspace();
  const isPreview = previewMode;
  const interactionDisabled = disabled || isPreview;
  const resolvedContentEditableClassName =
    contentEditableClassName ??
    (isPreview ? COMPOSER_PREVIEW_CONTENT_EDITABLE_CLASS : undefined);
  const resolvedPlaceholderClassName =
    composerPlaceholderClassName ??
    (isPreview ? COMPOSER_PREVIEW_PLACEHOLDER_CLASS : undefined);
  const resolvedInitialMediaUploads = useMemo(
    () => (initialMediaUploads ?? []).map(buildInitialMediaUpload),
    [initialMediaUploads]
  );
  const allowedMediaKindsSet = useMemo(
    () => new Set(allowedMediaKinds),
    [allowedMediaKinds]
  );
  const allowImageUpload = useMemo(
    () => allowedMediaKindsSet.has("image") || allowedMediaKindsSet.has("gif"),
    [allowedMediaKindsSet]
  );
  const allowVideoUpload = useMemo(
    () => allowedMediaKindsSet.has("video"),
    [allowedMediaKindsSet]
  );
  const allowFileUpload = useMemo(
    () => allowedMediaKindsSet.has("file"),
    [allowedMediaKindsSet]
  );
  const imageAccept = useMemo(() => {
    const accepts: string[] = [];
    if (allowedMediaKindsSet.has("image")) {
      accepts.push("image/jpeg", "image/jpg", "image/png", "image/webp");
    }
    if (allowedMediaKindsSet.has("gif")) {
      accepts.push("image/gif");
    }
    return accepts.join(",");
  }, [allowedMediaKindsSet]);
  const allowedMediaKindsLabel = useMemo(() => {
    const labels: string[] = [];
    if (allowedMediaKindsSet.has("image")) {
      labels.push("images");
    }
    if (allowedMediaKindsSet.has("gif")) {
      labels.push("GIFs");
    }
    if (allowedMediaKindsSet.has("video")) {
      labels.push("videos");
    }
    if (allowedMediaKindsSet.has("file")) {
      labels.push("documents");
    }

    if (labels.length === 0) {
      return "attachments";
    }
    if (labels.length === 1) {
      return labels[0];
    }
    return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
  }, [allowedMediaKindsSet]);
  const [content, setContent] = useState<SerializedEditorState | undefined>(
    initialContent
  );
  const [mediaUploads, setMediaUploads] = useState<MediaUpload[]>(
    resolvedInitialMediaUploads
  );
  const voiceNote = useVoiceNoteRecorder(voiceNotePlatform);
  const attachedVoiceFileRef = useRef<File | null>(null);
  const mediaUploadsRef = useRef(mediaUploads);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editorAPI, setEditorAPI] = useState<ComposerEditorAPI | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const serializedInitialContent = useMemo(
    () => JSON.stringify(initialContent ?? null),
    [initialContent]
  );
  const serializedInitialMediaUploads = useMemo(
    () =>
      JSON.stringify(
        (initialMediaUploads ?? []).map((attachment) => ({
          id: attachment.id,
          url: attachment.url ?? null,
          serverUrl: attachment.serverUrl ?? null,
          uploadId: attachment.uploadId ?? null,
          type: attachment.type,
          mediaKind: attachment.mediaKind ?? null,
          fileName: attachment.fileName ?? null,
          mimeType: attachment.mimeType ?? null,
          size: attachment.size ?? null,
          description: attachment.description ?? null,
        }))
      ),
    [initialMediaUploads]
  );
  const prevInitialSerializedRef = useRef<string>(serializedInitialContent);
  const prevInitialMediaSerializedRef = useRef<string>(
    serializedInitialMediaUploads
  );

  useEffect(() => {
    mediaUploadsRef.current = mediaUploads;
  }, [mediaUploads]);

  useEffect(
    () => () => {
      for (const upload of mediaUploadsRef.current) {
        revokeComposerObjectUrl(upload.url);
      }
    },
    []
  );

  // Convex actions
  const generateUploadUrl = useMutation(
    api.mediaUploadMutations.generateUploadUrl
  );
  const processUploadedMedia = useAction(api.mediaUpload.processUploadedMedia);

  const handleMentionEntitySelection = useCallback(
    (entity: MentionEntitySearchResult) => {
      if (entity.kind !== "attachment") {
        return;
      }

      if (entity.attachmentDisabled) {
        toast.error("Attachment unavailable", {
          description:
            entity.attachmentDisabledReason ??
            "This attachment is not supported here.",
        });
        return;
      }

      const initialUpload = buildInitialMediaUploadFromMentionEntity(entity);
      if (!initialUpload?.serverUrl) {
        toast.error("Attachment unavailable", {
          description: entity.label,
        });
        return;
      }

      const alreadyAttached = mediaUploads.some(
        (upload) =>
          upload.uploadId === initialUpload.uploadId ||
          upload.serverUrl === initialUpload.serverUrl
      );
      if (alreadyAttached) {
        return;
      }

      const nextMediaKind = initialUpload.mediaKind;
      if (!nextMediaKind) {
        toast.error("Attachment unavailable", {
          description: entity.label,
        });
        return;
      }

      if (!allowedMediaKindsSet.has(nextMediaKind)) {
        toast.error(`This composer only supports ${allowedMediaKindsLabel}.`);
        return;
      }

      const currentActiveUploads = mediaUploads.filter(
        (upload) => upload.status !== "error"
      );
      if (currentActiveUploads.length >= maxAttachments) {
        toast.error(getAttachmentLimitError(maxAttachments));
        return;
      }

      const selectionError = getComposerSelectionError(
        currentActiveUploads.map((upload) => upload.mediaKind),
        nextMediaKind,
        entityMentions?.attachmentDestination,
        currentActiveUploads.reduce(
          (total, upload) => total + (upload.size ?? upload.file.size),
          0
        ),
        initialUpload.size ?? 0
      );
      if (selectionError) {
        toast.error(selectionError);
        return;
      }

      setMediaUploads((prev) => [
        ...prev,
        buildInitialMediaUpload(initialUpload),
      ]);
    },
    [
      allowedMediaKindsLabel,
      allowedMediaKindsSet,
      entityMentions?.attachmentDestination,
      maxAttachments,
      mediaUploads,
    ]
  );

  const getAttachmentDisabledReason = useCallback(
    (entity: MentionEntitySearchResult): string | null => {
      if (entity.kind !== "attachment") {
        return null;
      }
      if (entity.attachmentDisabled) {
        return (
          entity.attachmentDisabledReason ??
          "This attachment is not supported here."
        );
      }

      const initialUpload = buildInitialMediaUploadFromMentionEntity(entity);
      const nextMediaKind = initialUpload?.mediaKind;
      if (!initialUpload?.serverUrl || !nextMediaKind) {
        return "Attachment unavailable.";
      }
      if (!allowedMediaKindsSet.has(nextMediaKind)) {
        return `This composer only supports ${allowedMediaKindsLabel}.`;
      }

      const currentActiveUploads = mediaUploads.filter(
        (upload) => upload.status !== "error"
      );
      if (currentActiveUploads.length >= maxAttachments) {
        return getAttachmentLimitError(maxAttachments);
      }

      return getComposerSelectionError(
        currentActiveUploads.map((upload) => upload.mediaKind),
        nextMediaKind,
        entityMentions?.attachmentDestination,
        currentActiveUploads.reduce(
          (total, upload) => total + (upload.size ?? upload.file.size),
          0
        ),
        initialUpload.size ?? 0
      );
    },
    [
      allowedMediaKindsLabel,
      allowedMediaKindsSet,
      entityMentions?.attachmentDestination,
      maxAttachments,
      mediaUploads,
    ]
  );

  const resolvedEntityMentions = useMemo<
    ComposerEntityMentionsConfig | undefined
  >(
    () =>
      entityMentions
        ? {
            ...entityMentions,
            getAttachmentDisabledReason,
            onSelectEntity: (entity: MentionEntitySearchResult) => {
              handleMentionEntitySelection(entity);
              entityMentions.onSelectEntity?.(entity);
            },
          }
        : undefined,
    [entityMentions, getAttachmentDisabledReason, handleMentionEntitySelection]
  );

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

  useEffect(() => {
    if (
      serializedInitialMediaUploads === prevInitialMediaSerializedRef.current
    ) {
      return;
    }
    prevInitialMediaSerializedRef.current = serializedInitialMediaUploads;
    if (isComposerFocused) {
      return;
    }
    setMediaUploads(resolvedInitialMediaUploads);
  }, [
    isComposerFocused,
    resolvedInitialMediaUploads,
    serializedInitialMediaUploads,
  ]);

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

  // Frontend validation mirrors destination capability checks.
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
  const ALLOWED_FILE_TYPES = useMemo(
    () => new Set(LINKEDIN_MESSAGE_DOCUMENT_MIME_TYPES),
    []
  );
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
  const MAX_GIF_BYTES = 15 * 1024 * 1024; // 15 MB
  const MAX_VIDEO_BYTES = 512 * 1024 * 1024; // 512 MB
  const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
  const MAX_ATTACHMENTS = maxAttachments;

  const validateFile = useCallback(
    (
      file: File
    ):
      | { ok: true; kind: "image" | "video" | "file" }
      | { ok: false; error: string } => {
      const type = (file.type || "").toLowerCase();
      const mediaKind = inferMediaKindFromMimeType(type);
      const isLinkedInDm =
        entityMentions?.attachmentDestination?.platform === "linkedin" &&
        entityMentions.attachmentDestination.surface === "dm";

      if (!allowedMediaKindsSet.has(mediaKind)) {
        return {
          ok: false,
          error: `This composer only supports ${allowedMediaKindsLabel}.`,
        } as const;
      }

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
          if (file.size > (isLinkedInDm ? MAX_FILE_BYTES : MAX_IMAGE_BYTES)) {
            return {
              ok: false,
              error: `Image exceeds ${isLinkedInDm ? "15 MB" : "5 MB"}.`,
            } as const;
          }
        }
        return { ok: true, kind: "image" } as const;
      }

      if (ALLOWED_VIDEO_TYPES.has(type)) {
        if (file.size > (isLinkedInDm ? MAX_FILE_BYTES : MAX_VIDEO_BYTES)) {
          return {
            ok: false,
            error: `Video exceeds ${isLinkedInDm ? "15 MB" : "512 MB"}.`,
          } as const;
        }
        return { ok: true, kind: "video" } as const;
      }

      if (ALLOWED_FILE_TYPES.has(type)) {
        if (file.size > MAX_FILE_BYTES) {
          return {
            ok: false,
            error: "Document exceeds 15 MB.",
          } as const;
        }
        return { ok: true, kind: "file" } as const;
      }

      return {
        ok: false,
        error:
          "Invalid format. Allowed: JPG, PNG, WEBP, GIF; MP4, MOV; CSV, XLS, XLSX, DOC, DOCX, PPT, PPTX, PDF, or TXT.",
      } as const;
    },
    [
      ALLOWED_IMAGE_TYPES,
      ALLOWED_FILE_TYPES,
      ALLOWED_VIDEO_TYPES,
      MAX_FILE_BYTES,
      MAX_GIF_BYTES,
      MAX_IMAGE_BYTES,
      MAX_VIDEO_BYTES,
      allowedMediaKindsLabel,
      allowedMediaKindsSet,
      entityMentions?.attachmentDestination,
    ]
  );

  useEffect(() => {
    const recording = voiceNote.recording;
    if (!recording || attachedVoiceFileRef.current === recording.file) return;
    attachedVoiceFileRef.current = recording.file;
    for (const upload of mediaUploadsRef.current) {
      revokeComposerObjectUrl(upload.url);
    }
    setMediaUploads([
      {
        id: `voice-note-${getCurrentUTCTimestamp()}`,
        file: recording.file,
        url: URL.createObjectURL(recording.file),
        type: "file",
        mediaKind: "file",
        size: recording.file.size,
        durationMs: recording.durationMs,
        waveform: recording.waveform,
        isVoiceNote: true,
        progress: 100,
        status: "completed",
      },
    ]);
  }, [voiceNote.recording]);

  const handleMediaUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!deferMediaUpload && !workspace?._id) {
        toast.error("Attachment unavailable", {
          description: "Select a workspace before uploading an attachment.",
        });
        return;
      }

      const fileArray = Array.isArray(files) ? files : Array.from(files);

      // Count current active attachments against this composer's limit.
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
          const mediaKind = inferMediaKindFromMimeType(file.type);
          prepared.push({
            id,
            file,
            type:
              mediaKind === "video"
                ? "video"
                : mediaKind === "file"
                  ? "file"
                  : "image",
            mediaKind,
            size: file.size,
            progress: 0,
            status: "error",
            error: validation.error,
          });
          continue;
        }

        const mediaKind = inferMediaKindFromMimeType(file.type);
        const activeKinds = [
          ...mediaUploads
            .filter((upload) => upload.status !== "error")
            .map((upload) => upload.mediaKind),
          ...prepared
            .filter((upload) => upload.status !== "error")
            .map((upload) => upload.mediaKind),
        ];
        const activeBytes = [
          ...mediaUploads.filter((upload) => upload.status !== "error"),
          ...prepared.filter((upload) => upload.status !== "error"),
        ].reduce(
          (total, upload) => total + (upload.size ?? upload.file.size),
          0
        );
        const selectionError = getComposerSelectionError(
          activeKinds,
          mediaKind,
          entityMentions?.attachmentDestination,
          activeBytes,
          file.size
        );
        if (selectionError) {
          prepared.push({
            id,
            file,
            type: validation.kind,
            mediaKind,
            progress: 0,
            status: "error",
            error: selectionError,
          });
          continue;
        }

        if (remainingSlots <= 0) {
          prepared.push({
            id,
            file,
            type: validation.kind,
            mediaKind,
            progress: 0,
            status: "error",
            error: getAttachmentLimitError(MAX_ATTACHMENTS),
          });
          continue;
        }

        remainingSlots -= 1;
        prepared.push({
          id,
          file,
          type: validation.kind,
          mediaKind,
          size: file.size,
          progress: deferMediaUpload ? 100 : 0,
          status: deferMediaUpload ? "completed" : "uploading",
          url: URL.createObjectURL(file),
        });
      }

      // Replace any previous error-only entries with the new selection
      setMediaUploads((prev) => [
        ...prev.filter((u) => u.status !== "error"),
        ...prepared,
      ]);

      for (const upload of prepared) {
        if (upload.status === "error" || upload.type === "file") continue;
        void readBrowserMediaMetadata(upload.file, upload.type).then(
          (metadata) => {
            if (!metadata.width || !metadata.height) return;
            setMediaUploads((current) =>
              current.map((item) =>
                item.id === upload.id ? { ...item, ...metadata } : item
              )
            );
          }
        );
      }

      if (deferMediaUpload) {
        return;
      }

      if (!workspace?._id) {
        return;
      }

      // Upload each valid file to the server
      for (const upload of prepared) {
        if (upload.status === "error") continue;

        try {
          // Step 1: Generate upload URL
          const uploadUrl = await generateUploadUrl({
            workspaceId: workspace._id,
          });

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
            workspaceId: workspace._id,
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
          console.error("[BaseComposer] Media upload failed", error);
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
      deferMediaUpload,
      MAX_ATTACHMENTS,
      processUploadedMedia,
      mediaUploads,
      validateFile,
      workspace?._id,
      entityMentions?.attachmentDestination,
    ]
  );

  const handleRemoveMedia = useCallback(
    (id: string) => {
      const removed = mediaUploadsRef.current.find(
        (upload) => upload.id === id
      );
      revokeComposerObjectUrl(removed?.url);
      if (removed?.isVoiceNote) {
        attachedVoiceFileRef.current = null;
        voiceNote.reset();
      }
      setMediaUploads((prev) => {
        return prev.filter((upload) => upload.id !== id);
      });
    },
    [voiceNote]
  );

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
    if ((submitMode === "confirmed" && isSubmitting) || interactionDisabled) {
      return;
    }

    const hasCompletedMedia = mediaUploads.some(
      (u) =>
        u.status === "completed" &&
        (Boolean(u.serverUrl) ||
          u.isVoiceNote ||
          (deferMediaUpload && u.file.size > 0))
    );
    const hasContent = !!content;
    const hasUploadingMedia = mediaUploads.some(
      (upload) => upload.status === "uploading"
    );
    const contentLength = content
      ? characterCountMode === "x_post"
        ? getXPostWeightedLength(extractTextFromEditorState(content))
        : extractTextFromEditorState(content).length
      : 0;
    if (
      submitDisabled ||
      hasUploadingMedia ||
      contentLength > maxLength ||
      (!hasContent && !hasCompletedMedia)
    ) {
      return;
    }

    // Extract server URLs and descriptions from completed uploads
    const completedUploads = mediaUploads.filter(
      (upload) =>
        upload.status === "completed" &&
        (Boolean(upload.serverUrl) ||
          upload.isVoiceNote ||
          (deferMediaUpload && upload.file.size > 0))
    );
    const completedUploadsWithMetadata = await Promise.all(
      completedUploads.map(withBrowserMediaMetadata)
    );

    const mediaUrls = completedUploads.flatMap((upload) =>
      upload.serverUrl ? [upload.serverUrl] : []
    );
    const mediaDescriptions = completedUploads.map(
      (upload) => upload.description || ""
    );
    const mediaKinds = completedUploads.map((upload) => upload.mediaKind);

    const resetComposer = (revokeMedia = true) => {
      setContent(undefined);
      if (revokeMedia) {
        for (const upload of completedUploadsWithMetadata) {
          revokeComposerObjectUrl(upload.url);
        }
      }
      setMediaUploads([]);
      attachedVoiceFileRef.current = null;
      voiceNote.reset();
      // Clear editor UI selection and nodes via bridge if available
      try {
        editorAPI?.clearContent();
      } catch {}
    };

    // When posting media-only, pass an empty editor state object to satisfy typing
    const contentForSubmit = content ?? ({} as SerializedEditorState);
    if (submitMode === "optimistic") {
      resetComposer(false);
      let retainMediaObjectUrls = false;
      try {
        const result = await onSubmit?.(
          contentForSubmit,
          mediaUrls,
          mediaDescriptions,
          mediaKinds,
          completedUploadsWithMetadata
        );
        retainMediaObjectUrls = result?.retainMediaObjectUrls === true;
      } catch (error) {
        console.error("[BaseComposer] Optimistic submit failed", error);
      } finally {
        if (!retainMediaObjectUrls) {
          for (const upload of completedUploadsWithMetadata) {
            revokeComposerObjectUrl(upload.url);
          }
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit?.(
        contentForSubmit,
        mediaUrls,
        mediaDescriptions,
        mediaKinds,
        completedUploadsWithMetadata
      );
      resetComposer();
    } catch (error) {
      console.error("[BaseComposer] Submit failed", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    characterCountMode,
    content,
    deferMediaUpload,
    editorAPI,
    interactionDisabled,
    isSubmitting,
    maxLength,
    mediaUploads,
    onSubmit,
    submitDisabled,
    submitMode,
    voiceNote,
  ]);

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
    (u) =>
      u.status === "completed" &&
      (Boolean(u.serverUrl) ||
        u.isVoiceNote ||
        (deferMediaUpload && u.file.size > 0))
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

  const voiceNoteActive = voiceNote.status !== "idle";
  const voiceNoteUpload = mediaUploads.find((upload) => upload.isVoiceNote);
  const voiceNoteTrigger = voiceNotePlatform ? (
    <VoiceNoteTrigger
      disabled={
        interactionDisabled ||
        isSubmitting ||
        hasText ||
        mediaUploads.some((upload) => upload.status !== "error")
      }
      onStart={() => void voiceNote.start()}
    />
  ) : null;

  const toolbarRow = showToolbar && (
    <div
      className={cn(
        "flex items-center gap-2",
        toolbarPlacement === "bottom" && "mt-1 pt-1"
      )}
    >
      <ComposerToolbar
        config={toolbarConfig}
        uploads={{
          imageAccept,
          fileAccept: LINKEDIN_MESSAGE_DOCUMENT_ACCEPT,
          showImage: allowImageUpload,
          showVideo: allowVideoUpload,
          showFile: allowFileUpload,
        }}
        onMediaUpload={handleMediaUpload}
        onEmojiSelect={handleEmojiSelect}
        submitButtonText={submitButtonText}
        submitButtonVariant={submitButtonVariant}
        onSubmit={handleSubmit}
        state={{
          canSubmit: !!canSubmit,
          isSubmitting,
          interactionDisabled,
          submitDisabled,
          isBoldActive: formattingState.isBold,
          isItalicActive: formattingState.isItalic,
        }}
        className="flex-1"
        onBold={handleBold}
        onItalic={handleItalic}
        afterEmojiSlot={
          voiceNoteTrigger ??
          renderMediaControl?.({
            addFiles: async (files) => await handleMediaUpload(files),
            disabled: interactionDisabled,
          }) ??
          afterEmojiSlot
        }
        beforeCounterSlot={beforeCounterSlot}
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
        disabled={interactionDisabled}
        submitOnEnter={submitOnEnter}
        onSubmitShortcut={handleSubmit}
        contentEditableClassName={resolvedContentEditableClassName}
        composerPlaceholderClassName={resolvedPlaceholderClassName}
        inlineAutocompleteContext={inlineAutocompleteContext}
        enableEntityMentions={
          enableEntityMentions || Boolean(resolvedEntityMentions)
        }
        entityMentions={resolvedEntityMentions}
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
        onAddDescription={
          showMediaDescription ? handleAddDescription : undefined
        }
        showDescription={showMediaDescription}
        className={toolbarPlacement === "bottom" ? "mb-3" : "mt-4"}
      />
    ) : null;

  const ogBlock =
    showOpenGraphPreview && previewUrl ? (
      <OpenGraphPreview
        url={previewUrl}
        onRemove={handleRemovePreview}
        className={toolbarPlacement === "bottom" ? "mb-3" : "mt-3"}
      />
    ) : null;

  const voiceNoteBlock = voiceNoteActive ? (
    <VoiceNoteComposer
      controller={voiceNote}
      sending={isSubmitting}
      onDelete={() => {
        if (voiceNoteUpload) handleRemoveMedia(voiceNoteUpload.id);
        else voiceNote.reset();
      }}
      onSend={() => void handleSubmit()}
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

          {voiceNoteBlock ? (
            voiceNoteBlock
          ) : toolbarPlacement === "top" ? (
            <>
              {toolbarRow}
              {editorBlock}
              {mediaBlock}
              {ogBlock}
            </>
          ) : (
            <>
              {mediaBlock}
              {ogBlock}
              {editorBlock}
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
