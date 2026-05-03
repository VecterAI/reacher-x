// app/sitemap.ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { MetadataRoute } from "next";

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
      url: `${BASE_URL}/home/threads`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      return baseEntries;
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    const threadIds = (await convex.query(
      api.socialapiMutations.getThreadIds
    )) as string[];

    const threadUrls = threadIds.map((id) => ({
      url: `${BASE_URL}/home/threads/${id}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

    return [...baseEntries, ...threadUrls];
  } catch {
    return baseEntries;
  }
}
