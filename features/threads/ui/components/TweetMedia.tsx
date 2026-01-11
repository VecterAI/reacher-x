"use client";

import React, { useState } from "react";
import Image from "next/image";

import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";
import GalleryViewer from "./GalleryViewer";
import VideoTile from "./VideoTile";

import { Media } from "@/features/threads/types";

interface TweetMediaProps {
  media: Media[];
}

type Variant = { content_type: string; url: string; bitrate?: number };

function getHls(variants?: Variant[]): string | undefined {
  return variants?.find((v) => v.content_type === "application/x-mpegURL")?.url;
}

function getBestMp4(variants?: Variant[]): string | undefined {
  if (!variants) return undefined;
  const mp4s = variants.filter((v) => v.content_type === "video/mp4");
  mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0]?.url;
}

function getVideoUrls(item: Media): { hlsUrl?: string; mp4Url?: string } {
  const variants = item.video_info?.variants as Variant[] | undefined;
  return {
    hlsUrl: getHls(variants),
    mp4Url: getBestMp4(variants),
  };
}

const TweetMedia: React.FC<TweetMediaProps> = ({ media }) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const mediaList = media ?? [];
  if (mediaList.length === 0) return null;

  const uniqueMedia = mediaList.filter(
    (item, index, self) =>
      index === self.findIndex((m) => m.id_str === item.id_str)
  );

  // Compute aspect ratio for single item from the media itself.
  const computeAspect = (item: Media): number => {
    if (item.original_info) {
      return item.original_info.width / item.original_info.height;
    }
    if (item.sizes?.large) {
      return item.sizes.large.w / item.sizes.large.h;
    }
    return 16 / 9; // sensible default
  };

  const openViewerAt = (index: number) => {
    setInitialIndex(index);
    setViewerOpen(true);
  };

  const renderSingle = (item: Media) => {
    const aspectRatio = computeAspect(item);

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
          />
        </div>
      );
    }
    const onClick = () => openViewerAt(0);
    return (
      <div
        className="border-border relative w-full overflow-hidden rounded-md border"
        style={{ aspectRatio }}
      >
        <Image
          src={item.media_url_https || ""}
          alt={item.ext_alt_text || "Tweet image"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="eager"
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

            if (item.type === "video" || item.type === "animated_gif") {
              return (
                <div key={item.id_str || idx} className={cellClasses}>
                  <VideoTile
                    item={item}
                    ariaLabel="Tweet video preview"
                    onClick={onClick}
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
