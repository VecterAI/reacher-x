import type { ReactNode } from "react";
import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { getRelatedBlogPosts } from "@/features/blog/lib/blogHelpers";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts } from "@/features/blog/lib/blogPosts";
import { blogPostMetadata } from "@/features/blog/lib/blogMetadata";
import { BlogArticle } from "@/features/blog/ui/components/BlogArticle";
type Props = { params: Promise<{ slug: string }> };
export async function generateStaticParams() {
  return (await getBlogPosts()).map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props) {
  const post = await getBlogPost((await params).slug);
  if (!post) notFound();
  return blogPostMetadata(post);
}
export default function BlogPostPage({ params }: Props) {
  return <BlogPostContent params={params} author={<BlogAuthor />} />;
}

async function BlogPostContent({
  params,
  author,
}: Props & { author: ReactNode }) {
  "use cache";
  const post = await getBlogPost((await params).slug);
  if (!post) notFound();
  const { default: Content } = await import(`@/content/blog/${post.slug}.mdx`);
  const related = getRelatedBlogPosts(post, await getBlogPosts());
  return (
    <BlogArticle author={author} post={post} related={related}>
      <Content />
    </BlogArticle>
  );
}
