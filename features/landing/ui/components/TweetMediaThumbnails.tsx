"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/shared/lib/utils/utils";

export interface TweetMediaThumbnailsProps {
  media: any[];
  currentIndex?: number;
  onThumbnailClick?: (index: number) => void;
  className?: string;
  variant?: "tweet" | "drawer";
}

export const TweetMediaThumbnails: React.FC<TweetMediaThumbnailsProps> = ({
  media,
  currentIndex = 0,
  onThumbnailClick,
  className,
  variant = "tweet",
}) => {
  if (!media || media.length === 0) return null;

  // Deduplicate media items based on their unique id_str.
  const dedupedMedia = media.filter(
    (item, index, self) =>
      index === self.findIndex((m) => m.id_str === item.id_str)
  );

  const isTweet = variant === "tweet";
  const isDrawer = variant === "drawer";

  // In "tweet" mode, show only the first 2 thumbnails.
  const thumbnailsToShow = isTweet ? dedupedMedia.slice(0, 2) : dedupedMedia;
  const remainingCount = isTweet
    ? dedupedMedia.length - thumbnailsToShow.length
    : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {thumbnailsToShow.map((item, index) => {
        // For video/animated GIF, use the provided thumbnail if available.
        const thumbnailUrl =
          (item.type === "video" || item.type === "animated_gif") &&
          item.thumbnails &&
          Array.isArray(item.thumbnails) &&
          item.thumbnails.length > 0
            ? item.thumbnails[0].url
            : item.media_url_https;

        // In drawer mode, highlight the active thumbnail.
        const isActive = isDrawer && currentIndex === index;

        // Build class names based on the variant.
        const thumbnailClasses = cn(
          "relative h-8 w-8 rounded duration-100",
          isDrawer
            ? // Drawer variant: add padding, clickable, and 1px border (or 2px if active).
              cn(
                "p-0.5 cursor-pointer hover:opacity-80",
                isActive ? "border-2 border-primary" : "border border-border"
              )
            : // Tweet variant: no padding, non-clickable, and a 4px border with 'border-main'.
              "cursor-default border-4 border-main",
          // In tweet variant, apply a negative left margin to all but the first thumbnail.
          isTweet && index > 0 && "ml-[-16px]"
        );

        return (
          <div
            key={item.id_str || index}
            className={thumbnailClasses}
            onClick={
              isDrawer && onThumbnailClick
                ? () => onThumbnailClick(index)
                : undefined
            }
          >
            <Image
              src={thumbnailUrl}
              alt={item.ext_alt_text || "Tweet media"}
              width={32}
              height={32}
              className="h-full w-full rounded-[2px] object-cover"
            />
          </div>
        );
      })}
      {/* In tweet variant, show the +X badge if there are more thumbnails. */}
      {isTweet && remainingCount > 0 && (
        <div
          className={cn(
            "z-10 flex h-8 w-8 cursor-default items-center justify-center rounded bg-muted font-mono text-xs font-medium",
            "ml-[-16px]", // Match the stacking negative margin.
            "border-4 border-main" // Tweet variant: 4px border with border-main.
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
