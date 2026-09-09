"use client";

import Link from "next/link";
import { buttonVariants } from "@/shared/ui/components/Button";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/components/Input";
import {
  PillLink,
  PillNavigation,
} from "@/shared/ui/components/pill-navigation/Pill";
import { SearchIcon, RssIcon } from "@/shared/ui/components/icons";
import {
  getBlogCategory,
  blogCategoryHref,
  type BlogCategory,
} from "../../lib/blogHelpers";
export function BlogToolbar({
  category,
  categories,
  query = "",
  onSearch,
}: {
  category?: BlogCategory;
  categories: readonly BlogCategory[];
  query?: string;
  onSearch?: (query: string) => void;
}) {
  const tabs = [
    { slug: undefined, label: "All" },
    ...categories.map((slug) => ({
      slug,
      label: getBlogCategory(slug)!.label,
    })),
  ];
  return (
    <div className="mb-10 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <PillNavigation aria-label="Blog categories">
        {tabs.map((item) => (
          <PillLink
            key={item.label}
            asChild
            aria-current={category === item.slug ? "page" : undefined}
          >
            <Link
              href={`${blogCategoryHref(item.slug)}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
            >
              {item.label}
            </Link>
          </PillLink>
        ))}
      </PillNavigation>
      <div className="flex w-full items-center gap-2 lg:w-60 lg:shrink-0">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-current"
          />
          <Input
            size="sm"
            type="search"
            aria-label="Search blog posts"
            placeholder="Search posts…"
            value={query}
            disabled={!onSearch}
            onChange={(event) => onSearch?.(event.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <a
          href="/blog/feed.xml"
          aria-label="Subscribe via RSS"
          title="Subscribe in your feed reader"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "text-muted-foreground size-9 shrink-0 rounded-full"
          )}
        >
          <RssIcon aria-hidden="true" className="fill-current" />
        </a>
      </div>
    </div>
  );
}
