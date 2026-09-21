"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/shared/ui/components/Carousel";
import { Button } from "@/shared/ui/components/Button";
import { ArrowBackIcon, ArrowForwardIcon } from "@/shared/ui/components/icons";
import { BlogCard } from "@/features/blog/ui/components/BlogCard";
import type { BlogPostSummary } from "@/features/blog/lib/blogHelpers";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import { marketingButton, marketingSectionTitle } from "./MarketingLayout";

type CategoryTab = { slug: string; label: string };

/** Surfaced first on the All tab; the rest follows in publish order. */
const CURATED_SLUGS = [
  "think-in-networks",
  "what-reacherx-is-for",
  "reach-out-and-get-replies",
  "getting-started-with-reacherx",
  "find-potential-customers",
];

const ALL_TAB = "all";
const MAX_ALL_POSTS = 12;

function orderAllPosts(posts: BlogPostSummary[]) {
  const curated = CURATED_SLUGS.map((slug) =>
    posts.find((post) => post.slug === slug)
  ).filter((post) => post !== undefined);
  const rest = posts.filter(
    (post) => !CURATED_SLUGS.includes(post.slug)
  );
  return [...curated, ...rest].slice(0, MAX_ALL_POSTS);
}

/** Homepage blog slice: the /blog tabs above a carousel of /blog cards. */
export function MarketingBlogBrowser({
  posts,
  categories,
  author,
}: {
  posts: BlogPostSummary[];
  categories: CategoryTab[];
  author: ReactNode;
}) {
  const [active, setActive] = useState(ALL_TAB);
  const [api, setApi] = useState<CarouselApi>();
  const [plugins] = useState(() => [WheelGesturesPlugin()]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const activeLabel =
    active === ALL_TAB
      ? null
      : (categories.find((category) => category.slug === active)?.label ??
        null);

  const visible =
    active === ALL_TAB
      ? orderAllPosts(posts)
      : posts.filter((post) => post.category === active);

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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2 id="marketing-blog-heading" className={marketingSectionTitle}>
          {activeLabel ? `${activeLabel}.` : "Blog."}
        </h2>
        <Link href="/blog" className={marketingButton({ variant: "outline" })}>
          Read the blog
        </Link>
      </div>
      {categories.length > 0 ? (
        <div className="mt-8">
          <PillSelector
            items={[
              { value: ALL_TAB, label: "All" },
              ...categories.map((category) => ({
                value: category.slug,
                label: category.label,
              })),
            ]}
            value={active}
            onValueChange={setActive}
            label="Filter posts by category"
          />
        </div>
      ) : null}
      {visible.length > 0 ? (
        <div className="mt-10" key={active}>
          <Carousel
            setApi={setApi}
            plugins={plugins}
            tabIndex={0}
            opts={{ align: "start", dragFree: true }}
            className="capability-carousel"
            aria-label="Blog posts"
          >
            <CarouselContent
              className="-ml-6 touch-pan-y touch-pinch-zoom"
              viewportClassName="overflow-visible"
            >
              {visible.map((post) => (
                <CarouselItem
                  key={post.slug}
                  className="basis-[86%] pl-6 sm:basis-[380px] lg:basis-[420px]"
                >
                  <BlogCard author={author} post={post} featured />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          <div className="mt-8 flex justify-end gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous posts"
              disabled={!canPrev}
              onClick={() => api?.scrollPrev()}
              className="size-10"
            >
              <ArrowBackIcon className="size-5 fill-current" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="More posts"
              disabled={!canNext}
              onClick={() => api?.scrollNext()}
              className="size-10"
            >
              <ArrowForwardIcon className="size-5 fill-current" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
