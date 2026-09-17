import type { ReactNode } from "react";
import { BlogToolbar } from "./BlogToolbar";
import { cn } from "@/shared/lib/utils";
import { marketingPageWidth } from "@/features/landing/ui/components/marketing/MarketingLayout";
import {
  BLOG_PAGE_SIZE,
  type BlogCategory,
  BLOG_CATEGORIES,
  type BlogPostSummary,
} from "../../lib/blogHelpers";
import { BlogCard } from "./BlogCard";

// Render the default listing while URL state hydrates. This preserves the
// toolbar, card geometry, and real links in the prerendered HTML.
export function BlogIndexSkeleton({
  author,
  posts,
  categories,
  title = "Blog",
}: {
  author?: ReactNode;
  posts: BlogPostSummary[];
  categories: readonly BlogCategory[];
  title?: string;
}) {
  return (
    <div className={cn(marketingPageWidth, "py-12 md:py-16")}>
      <h1 className="mb-8 text-4xl font-normal text-balance md:text-5xl">
        {title}
      </h1>
      <BlogToolbar
        categories={categories}
        category={BLOG_CATEGORIES.find((item) => item.label === title)?.slug}
      />
      <section
        aria-label="Blog posts"
        className="grid gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3"
      >
        {posts.slice(0, BLOG_PAGE_SIZE).map((post) => (
          <BlogCard author={author} post={post} key={post.slug} featured />
        ))}
      </section>
    </div>
  );
}
