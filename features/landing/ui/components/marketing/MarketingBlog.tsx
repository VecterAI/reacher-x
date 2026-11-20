import type { ReactNode } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { getPublishedBlogCategories } from "@/features/blog/lib/blogHelpers";
import { getBlogPosts, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { MarketingSection } from "./MarketingLayout";
import { MarketingBlogBrowser } from "./MarketingBlogBrowser";

/** A visible slice of the blog: same cards, tabs, and author as /blog. */
export function MarketingBlog() {
  return <MarketingBlogContent author={<BlogAuthor />} />;
}

async function MarketingBlogContent({ author }: { author: ReactNode }) {
  "use cache";
  // Local MDX posts only change on deploy, and publish-date filtering runs when
  // the cache fills, so a daily refresh matches /blog.
  cacheLife("days");
  cacheTag("blog-posts");
  const posts = (await getBlogPosts()).map(summarizeBlogPost);
  const categories = getPublishedBlogCategories(posts).map(
    ({ slug, label }) => ({
      slug,
      label,
    })
  );

  return (
    <MarketingSection id="blog" labelledBy="marketing-blog-heading">
      <MarketingBlogBrowser
        posts={posts}
        categories={categories}
        author={author}
      />
    </MarketingSection>
  );
}
