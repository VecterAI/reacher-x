"use client";

import React, { useState } from "react";
import Image from "next/image";

import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";
import {
  getBestMp4VariantUrl,
  getHlsVariantUrl,
  type VideoVariant,
} from "@/shared/lib/twitter/mediaVariants";
import GalleryViewer from "./GalleryViewer";
import VideoTile from "./VideoTile";

import { Media } from "@/features/threads/types";
import { MediaUnavailablePlaceholder } from "@/shared/ui/components/MediaUnavailablePlaceholder";
import { MediaRetryButton } from "@/shared/ui/components/MediaRetryButton";
import { getMediaAspectRatio } from "@/shared/lib/platforms/mediaPresentation";
import { useRetryableMediaFailures } from "@/shared/ui/hooks/use-retryable-media-failures";

interface TweetMediaProps {
  media: Media[];
  onRetry?: (item: Media, index: number) => Promise<void> | void;
}

function computeMediaAspect(item: Media): number {
  if (item.original_info) {
    return getMediaAspectRatio(item.original_info);
  }
  if (item.sizes?.large) {
    return getMediaAspectRatio({
      width: item.sizes.large.w,
      height: item.sizes.large.h,
    });
  }
  const aspectRatio = item.video_info?.aspect_ratio;
  return getMediaAspectRatio({
    width: aspectRatio?.[0],
    height: aspectRatio?.[1],
  });
}

function getMediaKey(item: Media, index: number) {
  const identity = item.media_key ?? item.id_str ?? String(index);
  const sources = [
    item.media_url_https,
    ...(item.video_info?.variants?.map((variant) => variant.url) ?? []),
  ]
    .filter(Boolean)
    .join("|");
  return `${identity}:${sources}`;
}

function TweetMediaUnavailable({
  item,
  aspectRatio,
  isRetrying,
  onRetry,
}: {
  item: Media;
  aspectRatio?: number;
  isRetrying?: boolean;
  onRetry: () => void;
}) {
  const isVideo = item.type === "video" || item.type === "animated_gif";
  const label = isVideo ? "Video" : "Image";
  return (
    <div className="h-full w-full" style={{ aspectRatio }}>
      <MediaUnavailablePlaceholder
        kind={isVideo ? "video" : "image"}
        title={`${label} unavailable`}
        className="h-full min-h-0"
        action={
          <MediaRetryButton
            label={label}
            isRetrying={isRetrying}
            onRetry={onRetry}
          />
        }
      />
    </div>
  );
}

function getVideoUrls(item: Media): { hlsUrl?: string; mp4Url?: string } {
  const variants = item.video_info?.variants as VideoVariant[] | undefined;
  return {
    hlsUrl: getHlsVariantUrl(variants),
    mp4Url: getBestMp4VariantUrl(variants),
  };
}

const TweetMedia: React.FC<TweetMediaProps> = ({ media, onRetry }) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const { failedKeys, markFailed, retry, retryingKeys } =
    useRetryableMediaFailures();

  const mediaList = media ?? [];
  if (mediaList.length === 0) return null;

  const uniqueMedia = mediaList.filter(
    (item, index, self) =>
      index === self.findIndex((m) => m.id_str === item.id_str)
  );

  const openViewerAt = (index: number) => {
    setInitialIndex(index);
    setViewerOpen(true);
  };

  const markMediaUnavailable = (item: Media, index: number) => {
    markFailed(getMediaKey(item, index));
  };

  const retryMedia = (item: Media, index: number) => {
    const key = getMediaKey(item, index);
    void retry(key, () => onRetry?.(item, index)).catch((error) => {
      console.warn(
        "[TweetMedia] Unable to retry media",
        error instanceof Error ? error.message : String(error)
      );
    });
  };

  const renderSingle = (item: Media) => {
    const mediaKey = getMediaKey(item, 0);
    if (failedKeys.has(mediaKey)) {
      return (
        <TweetMediaUnavailable
          item={item}
          aspectRatio={computeMediaAspect(item)}
          isRetrying={retryingKeys.has(mediaKey)}
          onRetry={() => retryMedia(item, 0)}
        />
      );
    }
    const aspectRatio = computeMediaAspect(item);

    if (item.type === "video" || item.type === "animated_gif") {
      const { hlsUrl, mp4Url } = getVideoUrls(item);
      return (
        <div
          className="border-border relative w-full overflow-hidden rounded-md border"
          style={{ aspectRatio }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <VideoPlayer
            hlsUrl={hlsUrl}
            mp4Url={mp4Url}
            ariaLabel="Tweet video"
            poster={item.media_url_https}
            onError={() => markMediaUnavailable(item, 0)}
          />
        </div>
      );
    }
    const onClick = () => openViewerAt(0);
    return (
      <div
        className="border-border bg-muted/30 relative w-full overflow-hidden rounded-md border"
        style={{ aspectRatio }}
      >
        <Image
          src={item.media_url_https || ""}
          alt={item.ext_alt_text || "Tweet image"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="eager"
          onError={() => markMediaUnavailable(item, 0)}
        />
        <button
          type="button"
          aria-label="Open media viewer"
          className="absolute inset-0 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        />
      </div>
    );
  };

  // Single item view
  if (uniqueMedia.length === 1) {
    return (
      <>
        {renderSingle(uniqueMedia[0])}
        <GalleryViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          media={uniqueMedia}
          initialIndex={initialIndex}
        />
      </>
    );
  }

  // Multi-item grid (Twitter-style)
  const items = uniqueMedia.slice(0, 4);
  const isThree = items.length === 3;

  // Use a Twitter-like rectangular aspect for grids.
  const gridAspect = items.length === 2 ? 3 / 2 : 16 / 9;
  const gridClasses = isThree
    ? "grid grid-cols-2 grid-rows-2 gap-1 absolute inset-0"
    : items.length === 2
      ? "grid grid-cols-2 grid-rows-1 gap-1 absolute inset-0"
      : "grid grid-cols-2 grid-rows-2 gap-1 absolute inset-0";

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-md"
        style={{ aspectRatio: gridAspect }}
      >
        <div className={gridClasses}>
          {items.map((item, idx) => {
            const cellClasses = [
              "relative w-full h-full overflow-hidden rounded-md border border-border",
              isThree && idx === 0 ? "row-span-2" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const onClick = () => openViewerAt(idx);
            const mediaKey = getMediaKey(item, idx);
            if (failedKeys.has(mediaKey)) {
              return (
                <div key={mediaKey} className={cellClasses}>
                  <TweetMediaUnavailable
                    item={item}
                    isRetrying={retryingKeys.has(mediaKey)}
                    onRetry={() => retryMedia(item, idx)}
                  />
                </div>
              );
            }

            if (item.type === "video" || item.type === "animated_gif") {
              return (
                <div key={item.id_str || idx} className={cellClasses}>
                  <VideoTile
                    item={item}
                    ariaLabel="Tweet video preview"
                    onClick={onClick}
                    onError={() => markMediaUnavailable(item, idx)}
                    className="h-full w-full"
                  />
                </div>
              );
            }

            return (
              <div key={item.id_str || idx} className={cellClasses}>
                <Image
                  src={item.media_url_https || ""}
                  alt={item.ext_alt_text || "Tweet image"}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  onError={() => markMediaUnavailable(item, idx)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                />
                <button
                  type="button"
                  aria-label="Open media viewer"
                  className="absolute inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <GalleryViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={uniqueMedia}
        initialIndex={initialIndex}
      />
    </div>
  );
};

export { TweetMedia };
