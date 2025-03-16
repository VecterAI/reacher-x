// app/sitemap.ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { MetadataRoute } from "next";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
const BASE_URL = "https://reacherx.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const threadIds = (await convex.query(
    api.socialdata.getThreadIds
  )) as string[];
  const threadUrls = threadIds.map((id) => ({
    url: `${BASE_URL}/threads/${id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/threads`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...threadUrls,
  ];
}
