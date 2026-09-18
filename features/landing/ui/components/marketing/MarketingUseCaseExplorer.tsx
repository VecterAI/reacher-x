"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import { Button } from "@/shared/ui/components/Button";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { workspaceUseCaseIcons } from "@/shared/ui/components/icons/workspaceUseCaseIconHelpers";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  ArrowOutwardIcon,
} from "@/shared/ui/components/icons";
import { useDemoVisibility } from "@/features/blog/ui/components/app-demo/useDemoVisibility";
import { BlogAppDemo } from "@/features/blog/ui/components/app-demo/BlogAppDemo";
import "./marketing-carousel.css";
import {
  MARKETING_CAROUSEL_OPTIONS,
  preserveDemoWheelInteraction,
} from "@/features/landing/lib/marketingCarouselHelpers";

type UseCaseCardItem = (typeof MARKETING_USE_CASES)[number];

/** Each slide mounts only its visible demo; hover or focus starts playback. */
export function MarketingUseCaseExplorer() {
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
        opts={MARKETING_CAROUSEL_OPTIONS}
        onWheelCapture={preserveDemoWheelInteraction}
        className="capability-carousel"
        aria-label="Who you can find"
      >
        <CarouselContent
          className="-ml-6 touch-pan-y touch-pinch-zoom"
          viewportClassName="overflow-visible"
        >
          {MARKETING_USE_CASES.map((item) => (
            <CarouselItem
              key={item.slug}
              className="basis-[82%] pl-6 sm:basis-[420px] lg:basis-[560px]"
            >
              <UseCaseCard item={item} preloadRoot={api?.rootNode()} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-8 flex justify-end gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous use cases"
          disabled={!canPrev}
          onClick={() => api?.scrollPrev()}
          className="size-10"
        >
          <ArrowBackIcon className="size-5 fill-current" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="More use cases"
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

function UseCaseCard({
  item,
  preloadRoot,
}: {
  item: UseCaseCardItem;
  preloadRoot?: HTMLElement;
}) {
  const { root, visible, mounted } = useDemoVisibility(preloadRoot);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!visible) {
      setHovered(false);
      setFocused(false);
    }
  }, [visible]);
  const Icon = workspaceUseCaseIcons[item.useCaseKey];
  return (
    <article
      ref={root}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onPointerDownCapture={() => setFocused(false)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      className="blog-card border-border flex h-full min-w-0 flex-col border transition-colors duration-200 hover:border-neutral-50 hover:bg-neutral-50 motion-reduce:transition-none dark:hover:border-neutral-900 dark:hover:bg-neutral-900"
    >
      <Link
        href={item.blogHref}
        draggable={false}
        className="focus-visible:outline-ring flex flex-1 flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] lg:p-8"
      >
        <div
          className="mb-5 flex items-center justify-between"
          aria-hidden="true"
        >
          {Icon ? <Icon className="size-6 fill-current" /> : null}
          <ArrowOutwardIcon className="text-muted-foreground size-4 fill-current" />
        </div>
        <h3 className="text-2xl leading-8 font-normal">{item.goal}</h3>
        <p className="text-muted-foreground mt-4 text-base leading-7">
          {item.explanation}
        </p>
      </Link>
      <div className="capability-demo">
        {mounted && (
          <BlogAppDemo
            scenario={item.guide}
            title={item.goal}
            caption={item.explanation}
            playbackActive={hovered || focused}
            interaction="expanded"
            loading="eager"
          />
        )}
      </div>
    </article>
  );
}
