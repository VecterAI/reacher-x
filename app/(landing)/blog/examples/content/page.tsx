import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Content from "@/content/blog-examples/content.mdx";
import { BlogArticle } from "@/features/blog/ui/components/BlogArticle";
import { parseBlogPost } from "@/features/blog/lib/blogContentCore";
import { getBlogPosts } from "@/features/blog/lib/blogPosts";

export const metadata: Metadata = {
  title: "Content preview | ReacherX",
  description: "A preview of ReacherX blog content blocks.",
  robots: { index: false, follow: false },
};
export default async function BlogContentPreview() {
  const [source, related] = await Promise.all([
    readFile(
      path.join(process.cwd(), "content/blog-examples/content.mdx"),
      "utf8"
    ),
    getBlogPosts(),
  ]);
  const post = parseBlogPost(source, "content-preview");
  return (
    <BlogArticle post={post} related={related.slice(0, 2)} preview>
      <Content />
    </BlogArticle>
  );
}
