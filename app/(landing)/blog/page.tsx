import type { ReactNode } from "react";
import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { getPublishedBlogCategories } from "@/features/blog/lib/blogHelpers";
import { Suspense } from "react";
import { BlogIndex } from "@/features/blog/ui/components/BlogIndex";
import { BlogIndexSkeleton } from "@/features/blog/ui/components/BlogIndexSkeleton";
import { getBlogPosts, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { blogListingMetadata } from "@/features/blog/lib/blogMetadata";

export const metadata = {
  ...blogListingMetadata(),
  title: { absolute: "Blog" },
};
export default function BlogPage() {
  return <BlogPageContent author={<BlogAuthor />} />;
}

async function BlogPageContent({ author }: { author: ReactNode }) {
  "use cache";
  const posts = (await getBlogPosts()).map(summarizeBlogPost);
  const categories = getPublishedBlogCategories(posts).map(({ slug }) => slug);
  // This boundary handles nuqs/useSearchParams, not content I/O. Resolving the
  // local posts first keeps real article links in the prerendered fallback.
  return (
    <Suspense
      fallback={
        <BlogIndexSkeleton
          author={author}
          posts={posts}
          categories={categories}
        />
      }
    >
      <BlogIndex author={author} posts={posts} categories={categories} />
    </Suspense>
  );
}
