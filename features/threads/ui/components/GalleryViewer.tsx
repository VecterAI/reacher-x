"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
} from "@/shared/ui/components/Drawer";
import { Button } from "@/shared/ui/components/Button";

import { useIsMobile } from "@/shared/ui/hooks/useMobile";
import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";

import type { Media } from "@/features/threads/types";
import { CloseIcon } from "@/shared/ui/components/icons";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

type Variant = { content_type: string; url: string; bitrate?: number };
const getHls = (variants?: Variant[]) =>
  variants?.find((v) => v.content_type === "application/x-mpegURL")?.url;
const getBestMp4 = (variants?: Variant[]) => {
  if (!variants) return undefined;
  const mp4s = variants.filter((v) => v.content_type === "video/mp4");
  mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4s[0]?.url;
};

const ZoomPanImage: React.FC<{
  src: string;
  alt: string;
  resetKey: number;
}> = ({ src, alt, resetKey }) => {
  const [scale, setScale] = useState(1);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <TransformWrapper
        key={resetKey}
        initialScale={1}
        minScale={1}
        maxScale={4}
        limitToBounds={true}
        centerOnInit={true}
        centerZoomedOut={true}
        doubleClick={{ disabled: true }}
        pinch={{ disabled: true }}
        wheel={{ step: 0.1 }}
        panning={{ disabled: scale === 1, velocityDisabled: true }}
        onInit={(ref) => setScale(ref.state.scale)}
        onZoom={(ref) => setScale(ref.state.scale)}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
};

interface GalleryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: Media[];
  initialIndex?: number;
}

const GalleryViewer: React.FC<GalleryViewerProps> = ({
  open,
  onOpenChange,
  media,
  initialIndex = 0,
}) => {
  const [resetKey, setResetKey] = useState(0);
  const isMobile = useIsMobile();
  const carouselContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // No-op: previously synced selected index with initialIndex
  }, [initialIndex]);

  useEffect(() => {
    if (open) {
      try {
        carouselContainerRef.current?.focus();
      } catch {}
    }
  }, [open]);

  const handleCarouselReady = useCallback(
    (api: CarouselApi | null) => {
      if (!api) return;
      api.scrollTo(initialIndex, true);
      // Ensure keyboard works immediately without tap and hide outline
      requestAnimationFrame(() => {
        try {
          carouselContainerRef.current?.focus();
        } catch {}
      });
      api.on("select", () => {
        setResetKey((k) => k + 1);
        const videos = document.querySelectorAll<HTMLVideoElement>("video");
        videos.forEach((v) => {
          try {
            if (typeof v.pause === "function") v.pause();
          } catch {}
        });
      });
    },
    [initialIndex]
  );

  const viewerHeightClass = "h-full min-h-0";

  const content = useMemo(() => {
    return (
      <Carousel
        setApi={handleCarouselReady}
        orientation="horizontal"
        opts={{ loop: true, containScroll: "trimSnaps" }}
        className="h-full w-full focus:outline-none focus-visible:outline-none"
        tabIndex={0}
        ref={carouselContainerRef}
      >
        <CarouselContent className="h-full">
          {media.map((item, idx) => (
            <CarouselItem
              key={item.id_str || idx}
              className="h-full overflow-hidden"
            >
              <div className="flex h-full w-full items-center justify-center">
                {item.type === "video" || item.type === "animated_gif" ? (
                  <div
                    className="relative h-full w-full overflow-hidden"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <VideoPlayer
                      hlsUrl={getHls(item.video_info?.variants as Variant[])}
                      mp4Url={getBestMp4(
                        item.video_info?.variants as Variant[]
                      )}
                      ariaLabel="Tweet video"
                    />
                  </div>
                ) : (
                  <ZoomPanImage
                    src={item.media_url_https || ""}
                    alt={item.ext_alt_text || "Tweet image"}
                    resetKey={resetKey}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    );
  }, [media, resetKey, handleCarouselReady]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={!isMobile}
    >
      <DrawerContent fullScreen className="p-0">
        <DrawerHeader className="absolute right-0 flex items-center justify-end p-3">
          <DrawerClose asChild>
            <Button
              variant="outline"
              size="xsIcon"
              aria-label="Close"
              className="z-10"
            >
              <CloseIcon className="fill-current" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <div className={`flex-1 ${viewerHeightClass} w-full px-0`}>
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default GalleryViewer;
