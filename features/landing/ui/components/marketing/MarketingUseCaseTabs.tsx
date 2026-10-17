"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import {
  ArrowOutwardIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
} from "@/shared/ui/components/icons";
import { Button } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import {
  marketingButton,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import {
  MARKETING_CAROUSEL_OPTIONS,
  preserveDemoWheelInteraction,
} from "@/features/landing/lib/marketingCarouselHelpers";
import { MarketingDemo } from "./MarketingDemo";

const TAB_ITEMS = MARKETING_USE_CASES.map((item) => ({
  value: item.slug,
  label: item.tabLabel,
}));

/**
 * Homepage use-case explorer. The deck is one embla carousel with a
 * full-width slide per use case; the pill tabs are its index. Dragging or
 * wheeling the deck drives the active tab, and picking a tab scrolls the
 * deck to that slide. Snap-to-slide keeps the view settled (dragFree stays
 * off for full-width slides), while the drag guard and wheel gestures
 * match the page's other carousels.
 */
export function MarketingUseCaseTabs() {
  const [activeSlug, setActiveSlug] = useState(TAB_ITEMS[0]?.value ?? "");
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
    const onSelect = () => {
      update();
      const slug = MARKETING_USE_CASES[api.selectedScrollSnap()]?.slug;
      if (slug) setActiveSlug((prev) => (prev === slug ? prev : slug));
    };
    update();
    api.on("select", onSelect);
    api.on("reInit", update);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", update);
    };
  }, [api]);

  const handleTabChange = (slug: string) => {
    setActiveSlug(slug);
    const index = MARKETING_USE_CASES.findIndex((item) => item.slug === slug);
    if (index >= 0) api?.scrollTo(index);
  };

  return (
    <MarketingSection id="use-cases" labelledBy="use-case-tabs-heading">
      {/* Dual claim at a glance: it works for the visitor's scenario and
          reshapes itself around it; the tabs and deck below prove it.
          Headline and tabs center on desktop, left on mobile. */}
      <h2
        id="use-case-tabs-heading"
        className={cn(
          marketingSectionTitle,
          // The shared title token caps width at 3xl; this headline stays
          // one centered line on desktop, so release the cap there.
          "lg:max-w-none lg:text-center"
        )}
      >
        {"Works and "}
        <span className="font-pixel-square">adapts</span>
        {" to your use case."}
      </h2>
      <div className="mt-8 flex lg:justify-center">
        <PillSelector
          items={TAB_ITEMS}
          value={activeSlug}
          onValueChange={handleTabChange}
          label="Pick a use case"
        />
      </div>
      <div className="mt-10 lg:mt-14">
        <Carousel
          setApi={setApi}
          plugins={plugins}
          tabIndex={0}
          opts={{ ...MARKETING_CAROUSEL_OPTIONS, dragFree: false }}
          onWheelCapture={preserveDemoWheelInteraction}
          aria-label="Use case demos"
        >
          <CarouselContent className="touch-pan-y touch-pinch-zoom">
            {MARKETING_USE_CASES.map((item, index) => {
              const demoRight = index % 2 === 0;
              return (
                <CarouselItem key={item.slug} className="min-w-0 basis-full">
                  <div
                    className={cn(
                      "grid gap-8 lg:gap-x-14 lg:gap-y-10",
                      demoRight
                        ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
                        : "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
                    )}
                  >
                    <div
                      className={cn(
                        "min-w-0 self-center lg:max-w-xs",
                        demoRight
                          ? "lg:col-start-1 lg:row-start-1"
                          : "lg:col-start-2 lg:row-start-1"
                      )}
                    >
                      <p className="text-lg leading-7 text-pretty">
                        {item.explanation}
                      </p>
                      <Link
                        href={item.blogHref}
                        className={marketingButton({
                          variant: "outline",
                          className: "mt-8",
                        })}
                      >
                        Read the guide
                        <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
                      </Link>
                    </div>
                    <div
                      className={cn(
                        "min-w-0",
                        demoRight
                          ? "lg:col-start-2 lg:row-start-1"
                          : "lg:col-start-1 lg:row-start-1"
                      )}
                    >
                      <MarketingDemo
                        scenario={item.guide}
                        title={item.goal}
                        caption={item.navigationDescription}
                      />
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
        <div className="mt-8 flex justify-end gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous use case"
            disabled={!canPrev}
            onClick={() => api?.scrollPrev()}
            className="size-10 rounded-full"
          >
            <ArrowBackIcon className="size-5 fill-current" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next use case"
            disabled={!canNext}
            onClick={() => api?.scrollNext()}
            className="size-10 rounded-full"
          >
            <ArrowForwardIcon className="size-5 fill-current" />
          </Button>
        </div>
      </div>
    </MarketingSection>
  );
}
