import { Suspense } from "react";
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
  const category = getBlogCategory((await params).category);
  if (!category) notFound();
  const allPosts = await getBlogPosts();
  const categories = getPublishedBlogCategories(allPosts).map(
    ({ slug }) => slug
  );
  if (!categories.includes(category.slug)) notFound();
  const posts = allPosts
    .filter((post) => post.category === category.slug)
    .map(summarizeBlogPost);
  // Resolve content first so the nuqs/useSearchParams fallback contains real
  // links for crawlers. Suspense is for URL state, not the local file reads.
  return (
    <Suspense
      fallback={
        <BlogIndexSkeleton
          posts={posts}
          categories={categories}
          title={category.label}
        />
      }
    >
      <BlogIndex
        posts={posts}
        categories={categories}
        category={category.slug}
      />
    </Suspense>
  );
}
