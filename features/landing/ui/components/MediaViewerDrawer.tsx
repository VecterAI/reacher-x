// components/MediaViewerDrawer.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";
import { Button } from "@/shared/ui/components/Button";
import Image from "next/image";
import VideoPlayer from "./VideoPlayer";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselApi,
} from "@/shared/ui/components/Carousel";
import { TweetMediaThumbnails } from "./TweetMediaThumbnails";

interface Media {
  id_str?: string;
  type: "photo" | "video" | "animated_gif";
  media_url_https?: string;
  original_info?: {
    width: number;
    height: number;
  };
  ext_alt_text?: string;
  video_info?: {
    variants: Array<{
      content_type: string;
      url: string;
      bitrate?: number;
    }>;
  };
}

export interface MediaViewerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: Media[];
  initialIndex?: number;
}

function renderMediaItem(item: Media) {
  if (item.type === "video" || item.type === "animated_gif") {
    const variants = item.video_info?.variants ?? [];
    const hlsVariant = variants.find(
      (v) => v.content_type === "application/x-mpegURL"
    );
    const mp4Variants = variants.filter((v) => v.content_type === "video/mp4");
    const mp4Variant = mp4Variants.reduce((prev, curr) => {
      return (prev.bitrate || 0) > (curr.bitrate || 0) ? prev : curr;
    }, {} as any);

    return (
      <VideoPlayer
        hlsUrl={hlsVariant?.url}
        mp4Url={mp4Variant?.url}
        ariaLabel="Tweet video"
      />
    );
  }

  return (
    <Image
      src={item.media_url_https || ""}
      alt={item.ext_alt_text || "Tweet image"}
      width={item.original_info?.width || 800}
      height={item.original_info?.height || 600}
      className="object-contain"
    />
  );
}

const MediaViewerDrawer: React.FC<MediaViewerDrawerProps> = ({
  open,
  onOpenChange,
  media,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  const handleCarouselApi = useCallback(
    (api: CarouselApi | null) => {
      if (!api) return;
      setCarouselApi(api);
      api.scrollTo(initialIndex);
      api.on("select", () => {
        setCurrentIndex(api.selectedScrollSnap());
      });
    },
    [initialIndex]
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[90vh">
        <header className="flex items-center justify-end p-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            Close
          </Button>
        </header>
        <h2 className="mb-4 mx-4 text-3xl">⇽ Media.</h2>
        {media.length > 1 && (
          <div className="flex overflow-x-auto px-4 pb-2">
            <TweetMediaThumbnails
              media={media}
              currentIndex={currentIndex}
              onThumbnailClick={(index) => {
                setCurrentIndex(index);
                carouselApi?.scrollTo(index);
              }}
            />
          </div>
        )}

        <Carousel
          className="relative w-full bg-background"
          opts={{ loop: true, containScroll: "trimSnaps" }}
          setApi={handleCarouselApi}
        >
          <CarouselContent>
            {media.map((item, index) => (
              <CarouselItem key={item.id_str || index}>
                <div className="flex h-[calc(80vh-150px)] w-full items-center justify-center overflow-hidden">
                  {renderMediaItem(item)}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {media.length > 1 && (
            <div className="flex items-center justify-between p-4">
              <CarouselPrevious
                className="static h-8 w-8 translate-y-[unset] rounded-md"
                variant="outline"
                size="icon"
              />
              <span className="font-mono text-sm">
                {currentIndex + 1}/{media.length}
              </span>
              <CarouselNext
                className="static h-8 w-8 translate-y-[unset] rounded-md"
                variant="outline"
                size="icon"
              />
            </div>
          )}
        </Carousel>
      </DrawerContent>
    </Drawer>
  );
};

export default MediaViewerDrawer;
