import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { getPublishedBlogCategories } from "@/features/blog/lib/blogHelpers";
import { getBlogPosts, summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { MarketingSection } from "./MarketingLayout";
import { MarketingBlogBrowser } from "./MarketingBlogBrowser";

/** A visible slice of the blog: same cards, tabs, and author as /blog. */
export async function MarketingBlog() {
  const posts = (await getBlogPosts()).map(summarizeBlogPost);
  const categories = getPublishedBlogCategories(posts).map(
    ({ slug, label }) => ({
      slug,
      label,
    })
  );

  return (
    <MarketingSection id="blog" labelledBy="marketing-blog-heading">
      <MarketingBlogBrowser
        posts={posts}
        categories={categories}
        author={<BlogAuthor />}
      />
    </MarketingSection>
  );
}
