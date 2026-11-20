import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
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
  const { post, related } = await getBlogContentPreviewData();
  return (
    <BlogArticle author={<BlogAuthor />} post={post} related={related} preview>
      <Content />
    </BlogArticle>
  );
}

async function getBlogContentPreviewData() {
  "use cache";
  cacheLife("days");
  cacheTag("blog-posts");
  const [source, related] = await Promise.all([
    readFile(
      path.join(process.cwd(), "content/blog-examples/content.mdx"),
      "utf8"
    ),
    getBlogPosts(),
  ]);
  return {
    post: parseBlogPost(source, "content-preview"),
    related: related.slice(0, 2),
  };
}
