import { SerializedEditorState } from "lexical";
import { Tweet } from "@/features/threads/types";

// Base composer types
/** `x_post`: X/Twitter weighted length (URLs count as fixed width). `raw`: JavaScript string length. */
export type ComposerCharacterCountMode = "raw" | "x_post";
export type ComposerMediaKind = "image" | "gif" | "video";

/** Viewer row in post/reply composer: prefer X connection snapshot, then WorkOS. */
export type ComposerIdentityUser = {
  name: string;
  screenName: string;
  profileImageUrl?: string;
  /** Shown when the connected X account is verified / has a non-`none` verified_type. */
  verified?: boolean;
};

export interface ComposerBaseProps {
  initialContent?: SerializedEditorState;
  initialMediaUploads?: ComposerInitialMediaUpload[];
  placeholder?: string;
  maxLength?: number;
  /** How to count characters against maxLength. Default x_post for parity with X when maxLength is post-sized. */
  characterCountMode?: ComposerCharacterCountMode;
  showCharacterCount?: boolean;
  showToolbar?: boolean;
  showEmojiPicker?: boolean;
  showMediaUpload?: boolean;
  maxAttachments?: number;
  disabled?: boolean;
  /** Render a disabled, visually clamped preview variant for inline review surfaces. */
  previewMode?: boolean;
  className?: string;
  /** Lexical ContentEditable root classes (default includes py-2). */
  contentEditableClassName?: string;
  /** Placeholder overlay classes; should match contentEditable vertical padding. */
  composerPlaceholderClassName?: string;
  /** Show Open Graph preview cards for detected URLs. Default true. */
  showOpenGraphPreview?: boolean;
  onContentChange?: (content: SerializedEditorState) => void;
  onSubmit?: (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[],
    mediaKinds?: ComposerMediaKind[]
  ) => void;
  onCancel?: () => void;
  onEditorBlur?: () => void;
  onEditorFocus?: () => void;
}

export interface ComposerInitialMediaUpload {
  id: string;
  url?: string;
  serverUrl?: string;
  uploadId?: string;
  type: "image" | "video";
  mediaKind?: ComposerMediaKind;
  description?: string;
}

// Reply composer specific types
export interface ReplyComposerProps extends ComposerBaseProps {
  replyTo: {
    tweet: Tweet;
    users: Array<{
      screenName: string;
      name: string;
    }>;
  };
  currentUser: ComposerIdentityUser;
  toolbarConfig?: ToolbarConfig;
  submitButtonVariant?: "text" | "icon";
  toolbarPlacement?: "top" | "bottom";
  showIdentityHeader?: boolean;
  showAvatar?: boolean;
  editorAreaClassName?: string;
  showMediaDescription?: boolean;
  onSubmit?: (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[],
    mediaKinds?: ComposerMediaKind[]
  ) => void;
}

// Note composer specific types
export interface NoteComposerProps extends ComposerBaseProps {
  noteId?: string;
  currentUser: ComposerIdentityUser;
  onSubmit?: (
    content: SerializedEditorState,
    mediaUrls?: string[],
    mediaDescriptions?: string[],
    mediaKinds?: ComposerMediaKind[]
  ) => void;
}

// Media upload types
export interface MediaUpload {
  id: string;
  file: File;
  url?: string; // Local blob URL for preview
  serverUrl?: string; // Server URL for backend access
  uploadId?: string; // Convex upload ID
  type: "image" | "video";
  mediaKind: ComposerMediaKind;
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
  description?: string; // Alt text/description for accessibility
}

// Composer state
export interface ComposerState {
  content: SerializedEditorState;
  mediaUploads: MediaUpload[];
  isSubmitting: boolean;
  error?: string;
}

// Toolbar configuration
export interface ToolbarConfig {
  showBold?: boolean;
  showItalic?: boolean;
  showEmoji?: boolean;
  showMedia?: boolean;
  showGif?: boolean;
  showLink?: boolean;
  showHashtag?: boolean;
  showMention?: boolean;
}

// Editor plugin configuration
export interface EditorPluginConfig {
  maxLength?: number;
  showCharacterCount?: boolean;
  enableAutoEmbed?: boolean;
  enableDragDrop?: boolean;
  enableEmoji?: boolean;
  enableHashtag?: boolean;
  enableMention?: boolean;
  enableLink?: boolean;
  enableAutocomplete?: boolean;
  enableTypingPref?: boolean;
}
