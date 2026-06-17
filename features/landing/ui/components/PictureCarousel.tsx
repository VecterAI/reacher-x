"use client";

import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import Autoplay, { type AutoplayType } from "embla-carousel-autoplay";
import { cn } from "@/shared/lib/utils";

// Define the shape of an image pair (mobile + desktop)
type ImagePair = {
  mobileSrc: string;
  desktopSrc: string;
  alt: string;
};

// Define the props the component accepts
type PictureCarouselProps = {
  images: ImagePair[]; // Array of image pairs
  delay?: number; // Autoplay delay in milliseconds (optional)
  className?: string; // Optional Tailwind classes
};

export function PictureCarousel({
  images,
  delay = 5000,
  className,
}: PictureCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const autoplay = api?.plugins().autoplay as AutoplayType | undefined;

  // Stop autoplay when the mouse enters the carousel
  const handleMouseEnter = () => {
    if (autoplay) {
      autoplay.stop();
    }
  };

  // Resume autoplay when the mouse leaves the carousel
  const handleMouseLeave = () => {
    if (autoplay) {
      autoplay.play();
    }
  };

  return (
    <Carousel
      setApi={setApi} // Store the carousel API
      opts={{ loop: true }}
      plugins={[Autoplay({ delay })]}
      className={cn(className, "overflow-hidden")}
      onMouseEnter={handleMouseEnter} // Stop on hover
      onMouseLeave={handleMouseLeave} // Resume on leave
    >
      <CarouselContent>
        {images.map((image) => (
          <CarouselItem key={`${image.mobileSrc}-${image.desktopSrc}`}>
            <picture>
              <source media="(max-width: 768px)" srcSet={image.mobileSrc} />
              <source media="(min-width: 769px)" srcSet={image.desktopSrc} />
              <img
                src={image.desktopSrc}
                alt={image.alt}
                className="h-auto w-full"
              />
            </picture>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
