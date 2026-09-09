"use client";

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useTransition } from "react";
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
  posts,
  categories,
  category,
}: {
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
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="mb-8 text-4xl font-normal text-balance md:text-5xl">
        {category ? getBlogCategory(category)?.label : "Blog"}
      </h1>
      <BlogToolbar
        categories={categories}
        category={category}
        query={q}
        onSearch={(query) => void setQuery({ q: query, page: 1 })}
      />
      <section aria-label="Blog posts" aria-busy={isLoadingMore}>
        <p
          role="status"
          className={
            q.trim() || !filtered.length
              ? "text-foreground mb-4 text-sm"
              : "sr-only"
          }
        >
          <span className="font-mono tabular-nums">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "post" : "posts"}
          {q.trim() ? ` matching “${q}”` : ""}
        </p>
        {filtered.length ? (
          <div className="grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {visiblePosts.map((post) => (
              <BlogCard key={post.slug} post={post} featured />
            ))}
          </div>
        ) : null}
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
