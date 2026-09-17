"use client";

import type { ReactNode } from "react";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { marketingPageWidth } from "@/features/landing/ui/components/marketing/MarketingLayout";
import { BlogToolbar } from "./BlogToolbar";
import { InfiniteScrollTrigger } from "@/shared/ui/components/InfiniteScrollTrigger";
import {
  BLOG_PAGE_SIZE,
  filterBlogPosts,
  getBlogCategory,
  type BlogCategory,
  type BlogPostSummary,
} from "../../lib/blogHelpers";
import { BlogCard } from "./BlogCard";

export function BlogIndex({
  author,
  posts,
  categories,
  category,
}: {
  author?: ReactNode;
  posts: BlogPostSummary[];
  categories: readonly BlogCategory[];
  category?: BlogCategory;
}) {
  const [{ q, page }, setQuery] = useQueryStates(
    { q: parseAsString.withDefault(""), page: parseAsInteger.withDefault(1) },
    { history: "replace", shallow: true }
  );
  const filtered = filterBlogPosts(posts, q);
  const [isLoadingMore, startTransition] = useTransition();
  const pageCount = Math.max(1, Math.ceil(filtered.length / BLOG_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const visiblePosts = filtered.slice(0, currentPage * BLOG_PAGE_SIZE);
  const reducedMotion = useReducedMotion();
  const showSummary = Boolean(q.trim() || !filtered.length);
  const summary = (
    <>
      <span className="font-mono tabular-nums">{filtered.length}</span>{" "}
      {filtered.length === 1 ? "post" : "posts"}
      {q.trim() ? ` matching “${q}”` : ""}
    </>
  );
  const transition = {
    duration: reducedMotion ? 0 : 0.2,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  return (
    <div className={cn(marketingPageWidth, "py-12 md:py-16")}>
      <h1 className="mb-8 text-4xl font-normal text-balance md:text-5xl">
        {category ? getBlogCategory(category)?.label : "Blog"}
      </h1>
      <BlogToolbar
        categories={categories}
        category={category}
        query={q}
        onSearch={(query) => void setQuery({ q: query, page: 1 })}
      />
      <section
        aria-label="Blog posts"
        aria-busy={isLoadingMore}
        className="relative"
      >
        <p role="status" className="sr-only">
          {summary}
        </p>
        <AnimatePresence initial={false} mode="popLayout">
          {showSummary && (
            <motion.p
              key="search-summary"
              aria-hidden="true"
              className="text-foreground mb-4 text-sm"
              initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
              transition={transition}
            >
              {summary}
            </motion.p>
          )}
        </AnimatePresence>
        <motion.div
          layout={reducedMotion ? false : "position"}
          layoutDependency={showSummary}
          transition={{ layout: transition }}
          className="grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {visiblePosts.map((post) => (
            <BlogCard author={author} key={post.slug} post={post} featured />
          ))}
        </motion.div>
        <InfiniteScrollTrigger
          hasMore={currentPage < pageCount}
          isLoading={isLoadingMore}
          resultCount={visiblePosts.length}
          loadingLabel="Loading more posts"
          loadMoreLabel="Load more posts"
          onLoadMore={() => {
            if (isLoadingMore || currentPage >= pageCount) return;
            // Summaries are local MDX data already loaded with the page. The
            // transition keeps input responsive while the next batch renders.
            startTransition(async () => {
              await setQuery({ page: currentPage + 1 });
            });
          }}
        />
      </section>
    </div>
  );
}
