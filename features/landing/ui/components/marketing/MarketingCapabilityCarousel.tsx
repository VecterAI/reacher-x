"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import { Button } from "@/shared/ui/components/Button";
import {
  PersonCheckIcon,
  GroupIcon,
  FolderCopyIcon,
  InsertChartIcon,
  ActivityZoneIcon,
  ForumIcon,
  EditIcon,
  AutorenewIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
  ArrowOutwardIcon,
} from "@/shared/ui/components/icons";
import { useDemoVisibility } from "@/features/blog/ui/components/app-demo/useDemoVisibility";
import { BlogAppDemo } from "@/features/blog/ui/components/app-demo/BlogAppDemo";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import "./marketing-carousel.css";
import { MARKETING_CAPABILITY_CONTENT } from "@/features/landing/lib/marketingContentHelpers";

export type CapabilityItem = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href: string;
  demo: BlogDemoId;
};

const capabilityIcons = [
  PersonCheckIcon,
  GroupIcon,
  FolderCopyIcon,
  InsertChartIcon,
  ActivityZoneIcon,
  ForumIcon,
  EditIcon,
  AutorenewIcon,
];
export const MARKETING_CAPABILITIES: CapabilityItem[] =
  MARKETING_CAPABILITY_CONTENT.map((item, index) => ({
    ...item,
    icon: capabilityIcons[index],
  }));

export function MarketingCapabilityCarousel() {
  const [api, setApi] = useState<CarouselApi>();
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
        opts={{
          align: "start",
          watchDrag: (_api, event) =>
            !(
              event.target instanceof Element &&
              event.target.closest(
                ".blog-app-demo-controls, .blog-app-demo-expanded"
              )
            ),
        }}
        className="capability-carousel"
        aria-label="More capabilities"
      >
        <CarouselContent
          className="-ml-6 touch-pan-y touch-pinch-zoom"
          viewportClassName="overflow-visible"
        >
          {MARKETING_CAPABILITIES.map((item) => (
            <CarouselItem
              key={item.href}
              className="basis-[82%] pl-6 sm:basis-[420px] lg:basis-[560px]"
            >
              <CapabilityCard item={item} preloadRoot={api?.rootNode()} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="mt-8 flex justify-end gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous capabilities"
          disabled={!canPrev}
          onClick={() => api?.scrollPrev()}
          className="size-10"
        >
          <ArrowBackIcon className="size-5 fill-current" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="More capabilities"
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

export function CapabilityCard({
  item,
  preloadRoot,
}: {
  item: CapabilityItem;
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
        href={item.href}
        draggable={false}
        className="focus-visible:outline-ring flex flex-1 flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] lg:p-8"
      >
        <div
          className="mb-5 flex items-center justify-between"
          aria-hidden="true"
        >
          <item.icon className="size-6 fill-current" />
          <ArrowOutwardIcon className="text-muted-foreground size-4 fill-current" />
        </div>
        <h3 className="text-2xl leading-8 font-normal">{item.title}</h3>
        <p className="text-muted-foreground mt-4 text-base leading-7">
          {item.body}
        </p>
      </Link>
      <div className="capability-demo">
        {mounted && (
          <BlogAppDemo
            scenario={item.demo}
            title={item.title}
            caption={item.body}
            playbackActive={hovered || focused}
            interaction="expanded"
            loading="eager"
          />
        )}
      </div>
    </article>
  );
}
