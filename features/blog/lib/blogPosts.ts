import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { parseBlogPost, publicBlogPosts } from "./blogContentCore";
import type { BlogPostSummary } from "./blogHelpers";

const contentDirectory = path.join(process.cwd(), "content/blog");
export const getBlogPosts = cache(async () => {
  const files = (await readdir(contentDirectory)).filter((file) =>
    file.endsWith(".mdx")
  );
  const posts = await Promise.all(
    files.map(async (file) => {
      const post = parseBlogPost(
        await readFile(path.join(contentDirectory, file), "utf8"),
        file.slice(0, -4)
      );
      return post;
    })
  );
  return publicBlogPosts(
    posts,
    new Date(getCurrentUTCTimestamp()).toISOString().slice(0, 10)
  );
});

export async function getBlogPost(slug: string) {
  // Lookup before importing or reading a requested file prevents traversal and
  // keeps drafts/future posts out of every public endpoint.
  return (await getBlogPosts()).find((post) => post.slug === slug);
}

export function summarizeBlogPost(
  post: Awaited<ReturnType<typeof getBlogPosts>>[number]
): BlogPostSummary {
  const { content: _content, headings: _headings, ...summary } = post;
  return summary;
}
