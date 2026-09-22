"use client";

import { useEffect, useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon, ArrowForwardIcon } from "@/shared/ui/components/icons";
import { TestimonialCard } from "./TestimonialCard";
import type { Tweet } from "@/features/threads/types";

/** Same drag-and-arrow pattern as the capability carousels; no auto-drift. */
export function MarketingProofCarousel({ tweets }: { tweets: Tweet[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [plugins] = useState(() => [WheelGesturesPlugin()]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <div>
      <Carousel
        setApi={setApi}
        plugins={plugins}
        tabIndex={0}
        opts={{ align: "start", dragFree: true }}
        className="capability-carousel"
        aria-label="Early user quotes"
      >
        <CarouselContent
          className="-ml-6 touch-pan-y touch-pinch-zoom"
          viewportClassName="overflow-visible"
        >
          {tweets.map((tweet) => (
            <CarouselItem
              key={tweet.id_str}
              className="basis-[86%] pl-6 sm:basis-[400px] lg:basis-[440px]"
            >
              <TestimonialCard tweet={tweet} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-8 flex justify-end gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous quotes"
          disabled={!canPrev}
          onClick={() => api?.scrollPrev()}
          className="size-10"
        >
          <ArrowBackIcon className="size-5 fill-current" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="More quotes"
          disabled={!canNext}
          onClick={() => api?.scrollNext()}
          className="size-10"
        >
          <ArrowForwardIcon className="size-5 fill-current" />
        </Button>
      </div>
    </div>
  );
}
