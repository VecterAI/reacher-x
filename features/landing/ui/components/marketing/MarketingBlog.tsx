import Link from "next/link";
import { getBlogPosts, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { BlogCard } from "@/features/blog/ui/components/BlogCard";
import {
  marketingButton,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";

/** Curated, not the whole index: the philosophy posts plus the key guides. */
const CURATED_SLUGS = [
  "think-in-networks",
  "what-reacherx-is-for",
  "getting-started-with-reacherx",
  "find-potential-customers",
];

export async function MarketingBlog() {
  const summaries = (await getBlogPosts()).map(summarizeBlogPost);
  const curated = CURATED_SLUGS.map((slug) =>
    summaries.find((post) => post.slug === slug)
  ).filter((post) => post !== undefined);
  const picks = [...curated];
  for (const post of summaries) {
    if (picks.length >= CURATED_SLUGS.length) break;
    if (!picks.some((pick) => pick.slug === post.slug)) picks.push(post);
  }
  if (picks.length === 0) return null;

  return (
    <MarketingSection id="blog" labelledBy="marketing-blog-heading">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <h2 id="marketing-blog-heading" className={marketingSectionTitle}>
          Guides and thinking.
        </h2>
        <Link href="/blog" className={marketingButton({ variant: "outline" })}>
          Read the blog
        </Link>
      </div>
      <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((post) => (
          <BlogCard key={post.slug} post={post} showImage />
        ))}
      </div>
    </MarketingSection>
  );
}
