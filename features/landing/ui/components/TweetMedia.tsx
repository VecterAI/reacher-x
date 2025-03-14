"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/shared/ui/components/Carousel";
import { AspectRatio } from "@/shared/ui/components/AspectRatio";
import { Button } from "@/shared/ui/components/Button";
import VideoPlayer from "./VideoPlayer";
import MediaViewerDrawer from "./MediaViewerDrawer";
import { TweetMediaThumbnails } from "./TweetMediaThumbnails";
import { Media } from "@/app/(landing)/threads/types";

interface TweetMediaProps {
  media: Media[];
}

const TweetMedia: React.FC<TweetMediaProps> = ({ media }) => {
  if (!media || media.length === 0) return null;

  const uniqueMedia = media.filter(
    (item, index, self) =>
      index === self.findIndex((m) => m.id_str === item.id_str)
  );

  // Compute a standard aspect ratio from the first unique media item.
  let aspectRatio = 16 / 9; // fallback ratio
  const firstMedia = uniqueMedia[0];
  if (firstMedia) {
    if (firstMedia.original_info) {
      aspectRatio = firstMedia.original_info.width / firstMedia.original_info.height;
    } else if (firstMedia.sizes && firstMedia.sizes.large) {
      aspectRatio = firstMedia.sizes.large.w / firstMedia.sizes.large.h;
    }
  }

  // Compute a standard aspect ratio from the first unique media item.
  // let aspectRatio = 16 / 9; // fallback ratioS
  // const firstMedia = uniqueMedia[0];
  // if (firstMedia && firstMedia.original_info) {
  //   aspectRatio =
  //     firstMedia.original_info.width / firstMedia.original_info.height;
  // }

  // State for the "View All" drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const renderMediaItem = (item: any) => {
    if (item.type === "video" || item.type === "animated_gif") {
      const variants = item.video_info?.variants || [];
      const hlsVariant = variants.find(
        (v: any) => v.content_type === "application/x-mpegURL"
      );
      const mp4Variants = variants.filter(
        (v: any) => v.content_type === "video/mp4"
      );
      const mp4Variant = mp4Variants.reduce(
        (prev: any, curr: any) =>
          (prev.bitrate || 0) > (curr.bitrate || 0) ? prev : curr,
        {}
      );
      return (
        <VideoPlayer
          hlsUrl={hlsVariant?.url}
          mp4Url={mp4Variant?.url}
          ariaLabel="Tweet video"
          className="rounded-lg border border-border"
        />
      );
    } else if (item.type === "photo") {
      return (
        <Image
          src={item?.media_url_https}
          alt={item?.ext_alt_text || "Tweet image"}
          fill
          className="rounded-lg border border-border object-cover"
          loading="eager"
          unoptimized={item?.media_url_https.includes("9jnl6fmpas.ufs.sh")}
        />
      );
    }
    return null;
  };

  // Render a simple view if there's only one unique media item.
  if (uniqueMedia.length === 1) {
    return (
      <AspectRatio ratio={aspectRatio}>
        {renderMediaItem(uniqueMedia[0])}
      </AspectRatio>
    );
  }

  // More than one unique media item: render a Carousel with a "View All" button.
  return (
    <div>
      <Carousel className="overflow-x-hidden rounded-lg">
        <CarouselContent>
          {uniqueMedia.map((item, index) => (
            <CarouselItem key={item.id_str || index}>
              <AspectRatio ratio={aspectRatio}>
                {renderMediaItem(item)}
              </AspectRatio>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-2 flex items-center gap-1">
        <TweetMediaThumbnails
          media={uniqueMedia}
          currentIndex={0}
          variant="tweet"
        />
        <Button
          onClick={() => {
            setInitialIndex(0);
            setDrawerOpen(true);
          }}
          variant="ghost"
          size="sm"
        >
          View All
        </Button>
      </div>
      <MediaViewerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        media={uniqueMedia}
        initialIndex={initialIndex}
      />
    </div>
  );
};

export { TweetMedia };
