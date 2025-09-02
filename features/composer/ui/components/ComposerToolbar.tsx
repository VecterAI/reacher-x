"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
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
} from "@/components/ui/emoji-picker";

import {
  ImageIcon,
  VideoLibraryIcon,
  GifBoxIcon,
  MoodIcon,
  FormatBoldIcon,
  FormatItalicIcon,
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
  onMediaUpload,
  onGifSelect,
  submitButtonText = "Post",
  onSubmit,
  canSubmit = true,
  isSubmitting = false,
  className,
  isBoldActive,
  isItalicActive,
  beforeSubmitSlot,
}: ComposerToolbarProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && onMediaUpload) {
      onMediaUpload(files);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 text-foreground", className)}>
      {/* Media Upload */}
      {config.showMedia && (
        <>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleMediaUpload}
          />
          <input
            type="file"
            id="video-upload"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleMediaUpload}
          />

          <Button
            variant="ghost"
            size="xsIcon"
            onClick={() => document.getElementById("image-upload")?.click()}
            title="Add image"
          >
            <ImageIcon className="fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="xsIcon"
            onClick={() => document.getElementById("video-upload")?.click()}
            title="Add video"
          >
            <VideoLibraryIcon className="fill-current" />
          </Button>
        </>
      )}

      {/* GIF */}
      {config.showGif && (
        <Button
          variant="ghost"
          size="xsIcon"
          onClick={onGifSelect}
          title="Add GIF"
        >
          <GifBoxIcon className="fill-current" />
        </Button>
      )}

      {/* Emoji Picker */}
      {config.showEmoji && (
        <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xsIcon" title="Add emoji">
              <MoodIcon className="fill-current" />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <EmojiPicker>
              <EmojiPickerSearch />
              <EmojiPickerContent />
              <EmojiPickerFooter />
            </EmojiPicker>
          </PopoverContent>
        </Popover>
      )}

      {/* Text Formatting */}
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

      {/* Right controls: optional slot + submit button */}
      <div className="ml-auto flex items-center gap-2">
        {beforeSubmitSlot}
        <Button
          size="xs"
          disabled={!canSubmit || isSubmitting}
          onClick={onSubmit}
          aria-disabled={!canSubmit || isSubmitting}
          title={submitButtonText}
        >
          {isSubmitting ? "Posting..." : submitButtonText}
        </Button>
      </div>
    </div>
  );
}
