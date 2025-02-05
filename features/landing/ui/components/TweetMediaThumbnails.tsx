// components/TweetMediaThumbnails.tsx
"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/shared/lib/utils/utils";
import { YoutubeIcon } from "@/shared/ui/components/icons/index"; // Ensure you have a video icon component

export interface TweetMediaThumbnailsProps {
  media: any[];
  currentIndex?: number;
  onThumbnailClick?: (index: number) => void;
  className?: string;
}

export const TweetMediaThumbnails: React.FC<TweetMediaThumbnailsProps> = ({
  media,
  currentIndex,
  onThumbnailClick,
  className,
}) => {
  // Show first two thumbnails and, if needed, a “+N” thumbnail for extra media.
  const thumbnailsToShow = media.slice(0, 2);
  const remainingCount = media.length - thumbnailsToShow.length;

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      {thumbnailsToShow.map((item, index) => (
        <div
          key={item.id_str || index}
          className={cn(
            "h-8 w-8 cursor-pointer rounded p-[2px]",
            currentIndex === index && "border-2 border-primary"
          )}
          onClick={() => onThumbnailClick && onThumbnailClick(index)}
        >
          <Image
            src={item.media_url_https}
            alt={item.ext_alt_text || "Tweet media"}
            width={32}
            height={32}
            className="h-full rounded-[2px] object-cover"
          />
          {(item.type === "video" || item.type === "animated_gif") && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <YoutubeIcon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded bg-muted text-xs font-medium"
          onClick={() => onThumbnailClick && onThumbnailClick(2)}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
