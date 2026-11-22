"use client";

import { useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import { cn } from "@/shared/lib/utils";
import { MarketingCarouselEdgeFades } from "./MarketingCarouselEdgeFades";
import { TestimonialCard } from "./TestimonialCard";
import type { Tweet } from "@/features/threads/types";

/** Drag-and-wheel testimonials carousel with Vercel-style column dividers and edge fades. */
export function MarketingProofCarousel({ tweets }: { tweets: Tweet[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [plugins] = useState(() => [WheelGesturesPlugin()]);

  return (
    <div className="relative">
      <Carousel
        setApi={setApi}
        plugins={plugins}
        tabIndex={0}
        opts={{ align: "start", dragFree: true }}
        className="capability-carousel"
        aria-label="Early user quotes"
      >
        <CarouselContent
          className="ml-0 touch-pan-y touch-pinch-zoom"
          viewportClassName="overflow-visible"
        >
          {tweets.map((tweet, index) => {
            const isFirst = index === 0;
            const isLast = index > 0 && index === tweets.length - 1;
            return (
              <CarouselItem
                key={tweet.id_str}
                className={cn(
                  "relative basis-auto pl-0",
                  isFirst || isLast ? "w-78 sm:w-95" : "w-86 sm:w-107"
                )}
              >
                {!isFirst ? (
                  <div
                    aria-hidden="true"
                    className="bg-border pointer-events-none absolute -inset-y-5 left-0 w-px mask-[linear-gradient(rgba(0,0,0,0),rgb(0,0,0)_27px,rgb(0,0,0)_calc(100%-24px),rgba(0,0,0,0))]"
                  />
                ) : null}
                <div
                  className={cn(
                    "h-full",
                    isFirst
                      ? "pr-8 sm:pr-12"
                      : isLast
                        ? "pl-8 sm:pl-12"
                        : "px-8 sm:px-12"
                  )}
                >
                  <TestimonialCard tweet={tweet} />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      <MarketingCarouselEdgeFades
        api={api}
        defaultRightFade={tweets.length > 1}
      />
    </div>
  );
}
