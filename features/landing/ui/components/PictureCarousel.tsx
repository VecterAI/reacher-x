"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/shared/ui/components/Carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/shared/lib/utils/utils";

// Define the shape of an image pair (mobile + desktop)
type ImagePair = {
  mobileSrc: string;
  desktopSrc: string;
  alt: string;
};

// Define the props the component accepts
type CarouselProps = {
  images: ImagePair[]; // Array of image pairs
  delay?: number; // Autoplay delay in milliseconds (optional)
  className?: string; // Optional Tailwind classes
};

export function PictureCarousel({
  images,
  delay = 5000,
  className,
}: CarouselProps) {
  return (
    <Carousel
      opts={{ loop: true }}
      plugins={[Autoplay({ delay })]}
      className={cn(className, "overflow-hidden rounded-lg")} // Combines default and custom classes
    >
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <picture>
              <source
                media="(max-width: 768px)"
                srcSet={image.mobileSrc}
                className="rounded-lg"
              />
              <source
                media="(min-width: 769px)"
                srcSet={image.desktopSrc}
                className="rounded-lg"
              />
              <img
                src={image.desktopSrc}
                alt={image.alt}
                className="h-auto w-full rounded-lg"
              />
            </picture>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
