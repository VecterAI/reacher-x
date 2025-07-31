import { SerializedEditorState } from "lexical";
import { Tweet } from "@/features/threads/types";

// Base composer types
export interface ComposerBaseProps {
  placeholder?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  showToolbar?: boolean;
  showEmojiPicker?: boolean;
  showMediaUpload?: boolean;
  disabled?: boolean;
  className?: string;
  onContentChange?: (content: SerializedEditorState) => void;
  onSubmit?: (content: SerializedEditorState) => void;
  onCancel?: () => void;
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
  currentUser: {
    name: string;
    screenName: string;
    profileImageUrl?: string;
  };
  onSubmit?: (content: SerializedEditorState) => void;
}

// Note composer specific types
export interface NoteComposerProps extends ComposerBaseProps {
  noteId?: string;
  currentUser: {
    name: string;
    screenName: string;
    profileImageUrl?: string;
  };
  onSubmit?: (content: SerializedEditorState) => void;
}

// Media upload types
export interface MediaUpload {
  id: string;
  file: File;
  url?: string;
  type: "image" | "video";
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
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
