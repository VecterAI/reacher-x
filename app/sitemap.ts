// app/sitemap.ts
import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import {
  getPublishedBlogCategories,
  blogCategoryHref,
  blogHref,
  BLOG_ORIGIN,
} from "@/features/blog/lib/blogHelpers";

import { PUBLIC_MARKETING_PAGES } from "@/features/landing/lib/agentReadinessHelpers";

const BASE_URL = BLOG_ORIGIN;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Include canonical public pages only. Do not invent lastmod timestamps on
  // every request; article dates come from the content's editorial metadata.
  const baseEntries: MetadataRoute.Sitemap = PUBLIC_MARKETING_PAGES.map(
    (page) => ({ url: `${BASE_URL}${page.href}` })
  );

  const posts = await getBlogPosts();
  baseEntries.push(
    { url: `${BASE_URL}/blog` },
    ...getPublishedBlogCategories(posts).map((category) => ({
      url: `${BASE_URL}${blogCategoryHref(category.slug)}`,
    })),
    ...posts.map((post) => ({
      url: `${BASE_URL}${blogHref(post.slug)}`,
      lastModified: `${post.updated ?? post.date}T00:00:00Z`,
    }))
  );

  return baseEntries;
}
