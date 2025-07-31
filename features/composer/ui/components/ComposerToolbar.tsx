"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/utils/utils";
import { Button } from "@/shared/ui/components/Button";
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
  onEmojiSelect?: (emoji: string) => void;
  onMediaUpload?: (files: FileList) => void;
  onGifSelect?: () => void;
  className?: string;
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
  className,
}: ComposerToolbarProps) {
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && onMediaUpload) {
      onMediaUpload(files);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 border-b p-2", className)}>
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
            size="xs"
            onClick={() => document.getElementById("image-upload")?.click()}
            title="Add image"
          >
            <ImageIcon className="current" />
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={() => document.getElementById("video-upload")?.click()}
            title="Add video"
          >
            <VideoLibraryIcon className="current" />
          </Button>
        </>
      )}

      {/* GIF */}
      {config.showGif && (
        <Button variant="ghost" size="xs" onClick={onGifSelect} title="Add GIF">
          <GifBoxIcon className="current" />
        </Button>
      )}

      {/* Emoji Picker */}
      {config.showEmoji && (
        <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" title="Add emoji">
              <MoodIcon className="current" />
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
      {config.showBold && (
        <Button variant="ghost" size="xs" onClick={onBold} title="Bold">
          <FormatBoldIcon className="current" />
        </Button>
      )}

      {config.showItalic && (
        <Button variant="ghost" size="xs" onClick={onItalic} title="Italic">
          <FormatItalicIcon className="current" />
        </Button>
      )}

      {/* More Options */}
      <Button size="xs" className="ml-auto" title="Post">
        Post
      </Button>
    </div>
  );
}
