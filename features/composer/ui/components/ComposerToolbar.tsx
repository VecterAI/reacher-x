"use client";

import { useId, useState } from "react";
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
  MoodIcon,
  FormatBoldIcon,
  FormatItalicIcon,
  ArrowUpwardIcon,
} from "@/shared/ui/components/icons";
import { ToolbarConfig } from "../../types";

interface ComposerToolbarProps {
  config?: ToolbarConfig;
  onBold?: () => void;
  onItalic?: () => void;
  isBoldActive?: boolean;
  isItalicActive?: boolean;
  onEmojiSelect?: (emoji: string) => void;
  onMediaUpload?: (files: FileList) => void;
  onGifSelect?: () => void;
  // Submission controls (managed by BaseComposer)
  submitButtonText?: string;
  onSubmit?: () => void;
  canSubmit?: boolean;
  isSubmitting?: boolean;
  className?: string;
  // Optional slot rendered just before the submit button
  beforeSubmitSlot?: React.ReactNode;
  /** Text label vs compact up-arrow control (DM-style). */
  submitButtonVariant?: "text" | "icon";
}

const defaultConfig: ToolbarConfig = {
  showBold: true,
  showItalic: true,
  showEmoji: true,
  showMedia: true,
  showGif: true,
  showLink: true,
  showHashtag: true,
  showMention: true,
};

export function ComposerToolbar({
  config = defaultConfig,
  onBold,
  onItalic,
  onEmojiSelect,
  onMediaUpload,

  submitButtonText = "Post",
  onSubmit,
  canSubmit = true,
  isSubmitting = false,
  className,
  isBoldActive,
  isItalicActive,
  beforeSubmitSlot,
  submitButtonVariant = "text",
}: ComposerToolbarProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const inputId = useId();
  const imageInputId = `${inputId}-image`;
  const videoInputId = `${inputId}-video`;

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && onMediaUpload) {
      onMediaUpload(files);
    }
  };

  const handleEmojiSelect = ({ emoji }: { emoji: string }) => {
    if (onEmojiSelect) {
      onEmojiSelect(emoji);
    }
    setIsEmojiOpen(false);
  };

  return (
    <div className={cn("text-foreground flex items-center gap-1", className)}>
      {/* Media Upload */}
      {config.showMedia && (
        <>
          <input
            type="file"
            id={imageInputId}
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleMediaUpload}
          />
          <input
            type="file"
            id={videoInputId}
            accept="video/mp4,video/quicktime"
            multiple
            className="hidden"
            onChange={handleMediaUpload}
          />

          <Button
            variant="ghost"
            size="xsIcon"
            onClick={() => document.getElementById(imageInputId)?.click()}
            title="Add image"
          >
            <ImageIcon className="fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="xsIcon"
            onClick={() => document.getElementById(videoInputId)?.click()}
            title="Add video"
          >
            <VideoLibraryIcon className="fill-current" />
          </Button>
        </>
      )}

      {/* GIF */}
      {/* {config.showGif && (
        <Button
          variant="ghost"
          size="xsIcon"
          onClick={onGifSelect}
          title="Add GIF"
        >
          <GifBoxIcon className="fill-current" />
        </Button>
      )} */}

      {/* Emoji Picker */}
      {config.showEmoji && (
        <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xsIcon" title="Add emoji">
              <MoodIcon className="fill-current" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-0">
            <EmojiPicker
              className="h-[342px]"
              onEmojiSelect={handleEmojiSelect}
            >
              <EmojiPickerSearch />
              <EmojiPickerContent />
              <EmojiPickerFooter />
            </EmojiPicker>
          </PopoverContent>
        </Popover>
      )}

      {/* Text Formatting */}
      {(config.showBold || config.showItalic) && (
        <ToggleGroup type="multiple" size="xsIcon" className="ml-1">
          {config.showBold && (
            <ToggleGroupItem
              value="bold"
              aria-label="Toggle bold"
              data-state={isBoldActive ? "on" : "off"}
              onClick={onBold}
              title="Bold"
            >
              <FormatBoldIcon className="fill-current" />
            </ToggleGroupItem>
          )}
          {config.showItalic && (
            <ToggleGroupItem
              value="italic"
              aria-label="Toggle italic"
              data-state={isItalicActive ? "on" : "off"}
              onClick={onItalic}
              title="Italic"
            >
              <FormatItalicIcon className="fill-current" />
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      )}

      {/* Right controls: optional slot + submit button */}
      <div className="ml-auto flex items-center gap-1">
        {beforeSubmitSlot}
        {submitButtonVariant === "icon" ? (
          <Button
            variant="default"
            size="xsIcon"
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
            aria-disabled={!canSubmit || isSubmitting}
            title={submitButtonText}
            aria-label={submitButtonText}
          >
            {isSubmitting ? (
              <span className="text-xs">...</span>
            ) : (
              <ArrowUpwardIcon className="size-4 fill-current" />
            )}
          </Button>
        ) : (
          <Button
            size="xs"
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
            aria-disabled={!canSubmit || isSubmitting}
            title={submitButtonText}
          >
            {isSubmitting ? "Posting..." : submitButtonText}
          </Button>
        )}
      </div>
    </div>
  );
}
