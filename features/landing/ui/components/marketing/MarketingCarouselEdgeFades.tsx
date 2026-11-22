"use client";

import { useEffect, useState } from "react";
import type { CarouselApi } from "@/shared/ui/components/Carousel";
import { cn } from "@/shared/lib/utils";

/**
 * Viewport-edge gradient fades for full-bleed horizontal marketing carousels.
 * The left fade stays hidden at scroll start so the leading card aligned to
 * `marketingPageWidth` is never dimmed at rest, then fades in as soon as the
 * strip scrolls toward the left viewport edge.
 */
export function MarketingCarouselEdgeFades({
  api,
  defaultRightFade = true,
}: {
  api?: CarouselApi;
  defaultRightFade?: boolean;
}) {
  const [edges, setEdges] = useState({
    left: false,
    right: defaultRightFade,
  });

  useEffect(() => {
    if (!api) return;
    const update = () => {
      const progress = api.scrollProgress();
      const canScroll = api.canScrollPrev() || api.canScrollNext();
      const left = canScroll && (api.canScrollPrev() || progress > 0.002);
      const right = canScroll && (api.canScrollNext() || progress < 0.998);
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right }
      );
    };
    update();
    api.on("scroll", update);
    api.on("select", update);
    api.on("settle", update);
    api.on("reInit", update);
    return () => {
      api.off("scroll", update);
      api.off("select", update);
      api.off("settle", update);
      api.off("reInit", update);
    };
  }, [api]);

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "bg-background pointer-events-none absolute -inset-y-5 left-[calc(50%-50vw)] z-10 w-16 mask-[linear-gradient(to_right,rgb(0,0,0)_16px,rgba(0,0,0,0.737)_28%,rgba(0,0,0,0.54)_41%,rgba(0,0,0,0.38)_52%,rgba(0,0,0,0.28)_60%,rgba(0,0,0,0.192)_68%,rgba(0,0,0,0.125)_75%,rgba(0,0,0,0.075)_82%,rgba(0,0,0,0.043)_87%,rgba(0,0,0,0.02)_92%,rgba(0,0,0,0.008)_96%,rgba(0,0,0,0))] transition-opacity duration-150 motion-reduce:transition-none sm:w-34",
          edges.left ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "bg-background pointer-events-none absolute -inset-y-5 right-[calc(50%-50vw)] z-10 w-16 mask-[linear-gradient(to_left,rgb(0,0,0)_16px,rgba(0,0,0,0.737)_28%,rgba(0,0,0,0.54)_41%,rgba(0,0,0,0.38)_52%,rgba(0,0,0,0.28)_60%,rgba(0,0,0,0.192)_68%,rgba(0,0,0,0.125)_75%,rgba(0,0,0,0.075)_82%,rgba(0,0,0,0.043)_87%,rgba(0,0,0,0.02)_92%,rgba(0,0,0,0.008)_96%,rgba(0,0,0,0))] transition-opacity duration-150 motion-reduce:transition-none sm:w-34",
          edges.right ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}
