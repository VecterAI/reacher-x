import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import {
  getPublishedBlogCategories,
  blogCategoryHref,
  getBlogCategory,
} from "@/features/blog/lib/blogHelpers";
import { blogListingMetadata } from "@/features/blog/lib/blogMetadata";
import { getBlogPosts, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { BlogIndex } from "@/features/blog/ui/components/BlogIndex";
import { BlogIndexSkeleton } from "@/features/blog/ui/components/BlogIndexSkeleton";

type Props = { params: Promise<{ category: string }> };

// Category listings prerender every active category via generateStaticParams and "use cache".
// Resolving params directly avoids flashing a shell without the category's posts on navigation.
export const instant = false;

export async function generateStaticParams() {
  return getPublishedBlogCategories(await getBlogPosts()).map(({ slug }) => ({
    category: slug,
  }));
}
export async function generateMetadata({ params }: Props) {
  const category = getBlogCategory((await params).category);
  if (!category) notFound();
  return blogListingMetadata(
    category.label,
    blogCategoryHref(category.slug),
    category.description
  );
}
export default async function CategoryPage({ params }: Props) {
  const data = await getBlogCategoryData((await params).category);
  if (!data) notFound();
  const { category, categories, posts } = data;
  const author = <BlogAuthor />;
  // Resolve content first so the nuqs/useSearchParams fallback contains real
  // links for crawlers. Suspense is for URL state, not the local file reads.
  return (
    <Suspense
      fallback={
        <BlogIndexSkeleton
          author={author}
          posts={posts}
          categories={categories}
          title={category.label}
        />
      }
    >
      <BlogIndex
        author={author}
        posts={posts}
        categories={categories}
        category={category.slug}
      />
    </Suspense>
  );
}

async function getBlogCategoryData(categorySlug: string) {
  "use cache";
  cacheLife("days");
  cacheTag("blog-posts");
  const category = getBlogCategory(categorySlug);
  if (!category) return null;
  const allPosts = await getBlogPosts();
  const categories = getPublishedBlogCategories(allPosts).map(
    ({ slug }) => slug
  );
  if (!categories.includes(category.slug)) return null;
  const posts = allPosts
    .filter((post) => post.category === category.slug)
    .map(summarizeBlogPost);
  return { category, categories, posts };
}
