"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import type { UnifiedMedia } from "@/shared/lib/platforms/types";
import { CloseIcon } from "@/shared/ui/components/icons";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

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

interface LinkedInGalleryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: UnifiedMedia[];
  initialIndex?: number;
}

const LinkedInGalleryViewer: React.FC<LinkedInGalleryViewerProps> = ({
  open,
  onOpenChange,
  media,
  initialIndex = 0,
}) => {
  const [resetKey, setResetKey] = useState(0);
  const isMobile = useIsMobile();
  const carouselContainerRef = useRef<HTMLDivElement | null>(null);

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
              key={`${item.url}-${idx}`}
              className="h-full overflow-hidden"
            >
              <div className="flex h-full w-full items-center justify-center">
                {item.type === "video" ? (
                  <div
                    className="relative h-full w-full overflow-hidden"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <VideoPlayer mp4Url={item.url} ariaLabel="LinkedIn video" />
                  </div>
                ) : (
                  <ZoomPanImage
                    src={item.url}
                    alt={item.title || "LinkedIn image"}
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

export default LinkedInGalleryViewer;

