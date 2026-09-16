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

export type CapabilityItem = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href: string;
  demo: BlogDemoId;
};

export const MARKETING_CAPABILITIES: CapabilityItem[] = [
  {
    icon: PersonCheckIcon,
    title: "Qualification and enrichment",
    body: "Every match comes with research: profile details, recent posts, and why the person fits.",
    href: "/blog/how-reacherx-enrichment-works",
    demo: "how-reacherx-enrichment-works",
  },
  {
    icon: GroupIcon,
    title: "People management",
    body: "Track status, notes, and conversations for everyone you find. A light CRM without the sales jargon.",
    href: "/blog/manage-people-with-reacherx",
    demo: "manage-people-with-reacherx",
  },
  {
    icon: FolderCopyIcon,
    title: "Workspaces",
    body: "Give each goal or client its own △ Agent, people, and settings.",
    href: "/blog/workspaces-explained",
    demo: "workspaces-explained",
  },
  {
    icon: InsertChartIcon,
    title: "Analytics",
    body: "See replies, conversations, and results across your outreach in one report.",
    href: "/blog/read-your-reacherx-analytics",
    demo: "read-your-reacherx-analytics",
  },
  {
    icon: ActivityZoneIcon,
    title: "Agent observability",
    body: "Check what △ Agent did and why, at any moment. Pause it whenever you want.",
    href: "/blog/understand-agent-observability",
    demo: "understand-agent-observability",
  },
  {
    icon: ForumIcon,
    title: "Conversations in one place",
    body: "Read and reply to X/Twitter and LinkedIn messages side by side.",
    href: "/blog/manage-dm-conversations",
    demo: "manage-dm-conversations",
  },
  {
    icon: EditIcon,
    title: "Autocomplete",
    body: "Write faster with suggestions that match your voice.",
    href: "/blog/write-with-autocomplete",
    demo: "write-with-autocomplete",
  },
  {
    icon: AutorenewIcon,
    title: "What runs on its own",
    body: "Discovery and research keep working when you are away. Sending waits for you.",
    href: "/blog/what-reacherx-does-automatically",
    demo: "what-reacherx-does-automatically",
  },
];

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
