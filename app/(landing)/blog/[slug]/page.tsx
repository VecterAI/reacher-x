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
  const article = await getBlogArticleData((await params).slug);
  if (!article) notFound();
  const { post, related } = article;
  // Load MDX outside the cache so restored data never references client modules
  // that have not been registered in a fresh server process.
  const { default: Content } = await import(`@/content/blog/${post.slug}.mdx`);
  return (
    <BlogArticle author={author} post={post} related={related}>
      <Content />
    </BlogArticle>
  );
}

async function getBlogArticleData(slug: string) {
  "use cache";
  const post = await getBlogPost(slug);
  if (!post) return null;
  return { post, related: getRelatedBlogPosts(post, await getBlogPosts()) };
}
