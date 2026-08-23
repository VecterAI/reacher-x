"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/Button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/shared/ui/components/ToggleGroup";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/components/Popover";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
  EmojiPickerFooter,
} from "@/shared/ui/components/EmojiPicker";
import {
  ImageIcon,
  VideoLibraryIcon,
  AttachFileIcon,
  MoodIcon,
  FormatBoldIcon,
  FormatItalicIcon,
  ArrowUpwardIcon,
} from "@/shared/ui/components/icons";
import { ToolbarConfig } from "../../types";

interface ComposerToolbarUploadOptions {
  imageAccept?: string;
  videoAccept?: string;
  fileAccept?: string;
  showImage?: boolean;
  showVideo?: boolean;
  showFile?: boolean;
}

interface ComposerToolbarState {
  canSubmit?: boolean;
  isSubmitting?: boolean;
  interactionDisabled?: boolean;
  submitDisabled?: boolean;
  isBoldActive?: boolean;
  isItalicActive?: boolean;
}

interface ComposerToolbarProps {
  config?: ToolbarConfig;
  uploads?: ComposerToolbarUploadOptions;
  state?: ComposerToolbarState;
  onBold?: () => void;
  onItalic?: () => void;
  onEmojiSelect?: (emoji: string) => void;
  onMediaUpload?: (files: FileList) => void;
  onGifSelect?: () => void;
  submitButtonText?: string;
  onSubmit?: () => void;
  className?: string;
  /** Rendered immediately after the emoji control (e.g. draft save status). */
  afterEmojiSlot?: React.ReactNode;
  /** Rendered immediately before the character counter. */
  beforeCounterSlot?: React.ReactNode;
  /** Rendered immediately before the submit button (after char count slot). */
  submitToolbarStart?: React.ReactNode;
  /** Optional slot rendered just before the submit button. */
  beforeSubmitSlot?: React.ReactNode;
  /** Text label vs compact up-arrow control (DM-style). */
  submitButtonVariant?: "text" | "icon";
}

const defaultConfig: ToolbarConfig = {
  showBold: true,
  showItalic: true,
  showEmoji: true,
  showMedia: true,
  showVideo: true,
  showGif: true,
  showLink: true,
  showHashtag: true,
  showMention: true,
};

function ComposerMediaControls({
  config,
  uploads,
  interactionDisabled,
  onMediaUpload,
}: {
  config: ToolbarConfig;
  uploads: ComposerToolbarUploadOptions;
  interactionDisabled: boolean;
  onMediaUpload?: (files: FileList) => void;
}) {
  const inputId = useId();
  const imageInputId = `${inputId}-image`;
  const videoInputId = `${inputId}-video`;
  const fileInputId = `${inputId}-file`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    imageAccept = "image/jpeg,image/jpg,image/png,image/webp,image/gif",
    videoAccept = "video/mp4,video/quicktime",
    fileAccept,
    showImage = true,
    showVideo = true,
    showFile = false,
  } = uploads;

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (interactionDisabled) return;
    const files = event.target.files;
    if (files && onMediaUpload) onMediaUpload(files);
    event.target.value = "";
  };

  if (!config.showMedia) return null;

  return (
    <>
      {showImage ? (
        <>
          <input
            type="file"
            id={imageInputId}
            accept={imageAccept}
            multiple
            className="hidden"
            aria-label="Upload images"
            onChange={handleMediaUpload}
          />
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            disabled={interactionDisabled}
            tabIndex={interactionDisabled ? -1 : 0}
            aria-label="Add image"
            onClick={() => {
              if (!interactionDisabled)
                document.getElementById(imageInputId)?.click();
            }}
            title="Add image"
          >
            <ImageIcon className="fill-current" />
          </Button>
        </>
      ) : null}

      {showVideo ? (
        <>
          <input
            type="file"
            id={videoInputId}
            accept={videoAccept}
            multiple
            className="hidden"
            aria-label="Upload videos"
            onChange={handleMediaUpload}
          />
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            disabled={interactionDisabled}
            tabIndex={interactionDisabled ? -1 : undefined}
            aria-label="Add video"
            onClick={() => {
              if (!interactionDisabled)
                document.getElementById(videoInputId)?.click();
            }}
            title="Add video"
          >
            <VideoLibraryIcon className="fill-current" />
          </Button>
        </>
      ) : null}

      {showFile ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            id={fileInputId}
            accept={fileAccept}
            multiple
            className="hidden"
            aria-label="Upload files"
            onChange={handleMediaUpload}
          />
          <Button
            variant="ghost"
            size="xsIcon"
            type="button"
            disabled={interactionDisabled}
            tabIndex={interactionDisabled ? -1 : undefined}
            aria-label="Add file"
            onClick={() => {
              if (!interactionDisabled) fileInputRef.current?.click();
            }}
            title="Add file"
          >
            <AttachFileIcon className="fill-current" />
          </Button>
        </>
      ) : null}
    </>
  );
}

function ComposerEmojiControl({
  interactionDisabled,
  onEmojiSelect,
}: {
  interactionDisabled: boolean;
  onEmojiSelect?: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover
      open={interactionDisabled ? false : isOpen}
      onOpenChange={(open) => {
        if (!interactionDisabled) setIsOpen(open);
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xsIcon"
          type="button"
          title="Add emoji"
          disabled={interactionDisabled}
          tabIndex={interactionDisabled ? -1 : undefined}
        >
          <MoodIcon className="fill-current" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0">
        <EmojiPicker
          className="h-[342px]"
          onEmojiSelect={({ emoji }) => {
            onEmojiSelect?.(emoji);
            setIsOpen(false);
          }}
        >
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}

function ComposerFormattingControls({
  config,
  state,
  onBold,
  onItalic,
}: {
  config: ToolbarConfig;
  state: ComposerToolbarState;
  onBold?: () => void;
  onItalic?: () => void;
}) {
  if (!config.showBold && !config.showItalic) return null;

  return (
    <ToggleGroup type="multiple" size="xsIcon" className="ml-1">
      {config.showBold && (
        <ToggleGroupItem
          value="bold"
          aria-label="Toggle bold"
          data-state={state.isBoldActive ? "on" : "off"}
          onClick={state.interactionDisabled ? undefined : onBold}
          title="Bold"
          disabled={state.interactionDisabled}
        >
          <FormatBoldIcon className="fill-current" />
        </ToggleGroupItem>
      )}
      {config.showItalic && (
        <ToggleGroupItem
          value="italic"
          aria-label="Toggle italic"
          data-state={state.isItalicActive ? "on" : "off"}
          onClick={state.interactionDisabled ? undefined : onItalic}
          title="Italic"
          disabled={state.interactionDisabled}
        >
          <FormatItalicIcon className="fill-current" />
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  );
}

function ComposerSubmitControls({
  state,
  submitButtonText,
  submitButtonVariant,
  onSubmit,
}: {
  state: ComposerToolbarState;
  submitButtonText: string;
  submitButtonVariant: "text" | "icon";
  onSubmit?: () => void;
}) {
  const disabled =
    state.interactionDisabled ||
    state.submitDisabled ||
    !state.canSubmit ||
    state.isSubmitting;
  const sharedProps = {
    type: "button" as const,
    disabled,
    onClick: state.interactionDisabled ? undefined : onSubmit,
    "aria-disabled": disabled,
    title: submitButtonText,
    tabIndex: state.interactionDisabled ? -1 : undefined,
  };

  if (submitButtonVariant === "icon") {
    return (
      <Button
        {...sharedProps}
        variant="default"
        size="xsIcon"
        aria-label={submitButtonText}
      >
        <ArrowUpwardIcon className="size-4 fill-current" />
      </Button>
    );
  }

  return (
    <Button {...sharedProps} size="xs">
      {state.isSubmitting ? "Posting…" : submitButtonText}
    </Button>
  );
}

export function ComposerToolbar({
  config = defaultConfig,
  uploads = {},
  state: providedState = {},
  onBold,
  onItalic,
  onEmojiSelect,
  onMediaUpload,
  submitButtonText = "Post",
  onSubmit,
  className,
  afterEmojiSlot,
  beforeCounterSlot,
  submitToolbarStart,
  beforeSubmitSlot,
  submitButtonVariant = "text",
}: ComposerToolbarProps) {
  const state: ComposerToolbarState = {
    canSubmit: true,
    isSubmitting: false,
    interactionDisabled: false,
    submitDisabled: false,
    isBoldActive: false,
    isItalicActive: false,
    ...providedState,
  };

  return (
    <div className={cn("text-foreground flex items-center gap-1", className)}>
      <ComposerMediaControls
        config={config}
        uploads={uploads}
        interactionDisabled={Boolean(state.interactionDisabled)}
        onMediaUpload={onMediaUpload}
      />
      {config.showEmoji && (
        <ComposerEmojiControl
          interactionDisabled={Boolean(state.interactionDisabled)}
          onEmojiSelect={onEmojiSelect}
        />
      )}
      {afterEmojiSlot ? (
        <div className="flex shrink-0 items-center">{afterEmojiSlot}</div>
      ) : null}
      <ComposerFormattingControls
        config={config}
        state={state}
        onBold={onBold}
        onItalic={onItalic}
      />
      <div className="ml-auto flex items-center gap-1">
        {beforeCounterSlot || beforeSubmitSlot ? (
          <div className="relative flex items-center gap-1">
            {beforeCounterSlot ? (
              <div
                className="pointer-events-none absolute right-full mr-1.5 flex h-5 max-w-[5rem] items-center justify-end gap-1 overflow-hidden whitespace-nowrap"
                aria-live="polite"
              >
                {beforeCounterSlot}
                {beforeSubmitSlot ? (
                  <span className="text-muted-foreground text-xs">·</span>
                ) : null}
              </div>
            ) : null}
            {beforeSubmitSlot}
          </div>
        ) : null}
        {submitToolbarStart}
        <ComposerSubmitControls
          state={state}
          submitButtonText={submitButtonText}
          submitButtonVariant={submitButtonVariant}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
