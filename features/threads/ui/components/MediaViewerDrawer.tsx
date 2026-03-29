"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/ui/components/Drawer";
import { Button } from "@/shared/ui/components/Button";
import Image from "next/image";
import VideoPlayer from "../../../landing/ui/components/VideoPlayer";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselApi,
} from "@/shared/ui/components/Carousel";
import { TweetMediaThumbnails } from "./TweetMediaThumbnails";
import { Media } from "@/features/threads/types";
import {
  getBestMp4VariantUrl,
  getHlsVariantUrl,
  type VideoVariant,
} from "@/shared/lib/twitter/mediaVariants";

export interface MediaViewerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: Media[];
  initialIndex?: number;
}

function renderMediaItem(item: Media) {
  if (item.type === "video" || item.type === "animated_gif") {
    // For video, ensure the video scales within the container and allow controls to receive clicks.
    return (
      <div
        className="relative h-full w-full overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <VideoPlayer
          hlsUrl={getHlsVariantUrl(item.video_info?.variants as VideoVariant[])}
          mp4Url={getBestMp4VariantUrl(
            item.video_info?.variants as VideoVariant[]
          )}
          ariaLabel="Tweet video"
          poster={item.media_url_https}
        />
      </div>
    );
  }

  // For photos, wrap Next Image in a container.
  return (
    <div className="relative h-full w-full">
      <Image
        src={item.media_url_https || ""}
        alt={item.ext_alt_text || "Tweet image"}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-contain"
      />
    </div>
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

  // Scroll to initial index when drawer opens (via carousel API, not setState)
  useEffect(() => {
    if (open && carouselApi) {
      carouselApi.scrollTo(initialIndex);
    }
  }, [open, initialIndex, carouselApi]);

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
      <DrawerContent>
        <aside role="dialog" aria-modal="true" aria-labelledby="media-heading">
          <header>
            <DrawerHeader className="flex items-center justify-end p-4">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                Close
              </Button>
            </DrawerHeader>
          </header>
          <main className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-28">
            <DrawerTitle id="media-heading" className="text-3xl font-medium">
              Media.
            </DrawerTitle>
            {media.length > 1 && (
              <div className="mt-4 flex overflow-x-auto px-0.5 py-2">
                <TweetMediaThumbnails
                  variant="drawer"
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
              className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 w-full duration-300 md:mt-12"
              opts={{ loop: true, containScroll: "trimSnaps" }}
              setApi={handleCarouselApi}
            >
              <div className="overflow-hidden rounded-lg">
                <CarouselContent>
                  {media.map((item, index) => (
                    <CarouselItem key={item.id_str || index}>
                      <div className="flex h-[calc(80vh-150px)] w-full items-center justify-center overflow-hidden">
                        {renderMediaItem(item)}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </div>

              {media.length > 1 && (
                <nav
                  className="flex items-center justify-between py-4"
                  aria-label="Carousel Navigation"
                >
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
                </nav>
              )}
            </Carousel>
          </main>
        </aside>
      </DrawerContent>
    </Drawer>
  );
};

export default MediaViewerDrawer;
