"use client";

import * as React from "react";
import { USE_CASES } from "@/features/landing/lib/useCases";
import { UseCaseCard } from "@/features/landing/ui/components/UseCaseCard";
import {
  ScrollXCarousel,
  ScrollXCarouselContainer,
  ScrollXCarouselProgress,
  ScrollXCarouselWrap,
} from "@/components/systaliko-ui/scroll-x-carousel";

/**
 * Dynamically compute the xRange end-percentage so the last card lands
 * flush with the right edge at 100 % scroll — regardless of viewport width.
 */
function useDynamicEndX() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [endX, setEndX] = React.useState("-65%");

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const motionDiv = container.firstElementChild as HTMLElement | null;
    if (!motionDiv) return;

    function recalc() {
      const contentW = motionDiv!.scrollWidth;
      const visibleW = container!.clientWidth;
      if (contentW <= visibleW) {
        setEndX("0%");
        return;
      }
      const pct = ((contentW - visibleW) / contentW) * 100;
      setEndX(`-${pct.toFixed(1)}%`);
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return { containerRef, endX };
}

export function UseCasesSection() {
  const { containerRef, endX } = useDynamicEndX();

  return (
    <section id="use-cases" aria-labelledby="use-cases-heading">
      <ScrollXCarousel className="h-[200vh]">
        <ScrollXCarouselContainer className="top-12 flex h-[calc(100dvh-3rem)] flex-col items-stretch justify-center md:top-14 md:h-[calc(100dvh-3.5rem)]">
          {/* Heading — centered, constrained to content width */}
          <h2
            id="use-cases-heading"
            className="font-pixel-square mx-auto mb-16 w-full max-w-[1288px] px-4 text-center text-4xl font-bold md:mb-24 md:text-5xl"
          >
            One Agent that adapts to who you need.
          </h2>

          {/* Horizontal-scrolling cards — full viewport width, no padding */}
          <div ref={containerRef}>
            <ScrollXCarouselWrap
              xRagnge={["-0%", endX]}
              className="flex space-x-4 md:space-x-6 [&>*:first-child]:ml-[max(1rem,_calc((100vw_-_1288px)_/_2_+_1rem))] [&>*:last-child]:mr-[max(1rem,_calc((100vw_-_1288px)_/_2_+_1rem))]"
            >
              {USE_CASES.map((uc) => (
                <UseCaseCard
                  key={uc.slug}
                  useCase={uc}
                  className="min-w-[75vw] md:min-w-[35vw] xl:min-w-[28vw]"
                />
              ))}
            </ScrollXCarouselWrap>
          </div>

          {/* Progress bar */}
          <div className="mx-auto mt-12 w-full max-w-[1288px] px-4">
            <ScrollXCarouselProgress
              className="bg-secondary h-0.5 overflow-hidden"
              progressStyle="bg-primary size-full"
            />
          </div>
        </ScrollXCarouselContainer>
      </ScrollXCarousel>
    </section>
  );
}
