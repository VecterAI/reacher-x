// app/sitemap.ts
import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/features/blog/lib/blogPosts";
import {
  getPublishedBlogCategories,
  blogCategoryHref,
  blogHref,
} from "@/features/blog/lib/blogHelpers";

import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";

const BASE_URL = "https://reacherx.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/home`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/use-cases`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const posts = await getBlogPosts();
  baseEntries.push(
    { url: `${BASE_URL}/blog` },
    { url: `${BASE_URL}/product` },
    ...MARKETING_USE_CASES.map(({ href }) => ({ url: `${BASE_URL}${href}` })),
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
