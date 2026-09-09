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
export default async function BlogPostPage({ params }: Props) {
  const post = await getBlogPost((await params).slug);
  if (!post) notFound();
  const { default: Content } = await import(`@/content/blog/${post.slug}.mdx`);
  const related = (await getBlogPosts())
    .filter((candidate) => candidate.slug !== post.slug)
    .sort(
      (a, b) =>
        Number(b.category === post.category) -
        Number(a.category === post.category)
    )
    .slice(0, 2);
  return (
    <BlogArticle post={post} related={related}>
      <Content />
    </BlogArticle>
  );
}
