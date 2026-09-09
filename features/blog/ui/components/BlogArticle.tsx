import Link from "next/link";
import {
  blogCategoryHref,
  getBlogCategory,
  serializeBlogJson,
} from "@/features/blog/lib/blogHelpers";
import { summarizeBlogPost } from "@/features/blog/lib/blogPosts";
import { blogPostStructuredData } from "@/features/blog/lib/blogMetadata";
import { BlogAuthor } from "@/features/blog/ui/components/BlogAuthor";
import { BlogCard } from "@/features/blog/ui/components/BlogCard";
import { BlogPostMenu } from "@/features/blog/ui/components/BlogPostMenu";
import { BlogTableOfContents } from "@/features/blog/ui/components/BlogTableOfContents";
import { BlogImage } from "@/features/blog/ui/components/BlogMdx";
import { LandingAuthLink } from "@/features/landing/ui/components/LandingAuthLink";
import { LandingBookDemoCta } from "@/features/landing/ui/components/LandingBookDemoCta";
import { SETUP_SIGN_UP_HREF } from "@/shared/lib/urls/authRoutes";
import { buttonVariants } from "@/shared/ui/components/Button";

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/shared/ui/components/Breadcrumb";
import { BlogMetadata } from "./BlogMetadata";
import type { ReactNode } from "react";
import type { getBlogPosts } from "../../lib/blogPosts";
type Post = Awaited<ReturnType<typeof getBlogPosts>>[number];
export function BlogArticle({
  post,
  children,
  related = [],
  preview = false,
}: {
  post: Post;
  children: ReactNode;
  related?: Post[];
  preview?: boolean;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <article className="mx-auto max-w-180">
        <header className="mb-12">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/blog">Blog</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>·</BreadcrumbSeparator>
              <BreadcrumbItem>
                {preview ? (
                  <BreadcrumbPage>Content preview</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={blogCategoryHref(post.category)}>
                      {getBlogCategory(post.category)?.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {preview && (
            <p className="text-muted-foreground mb-4 font-mono text-xs">
              Content preview · Not a published post
            </p>
          )}
          <h1 className="text-4xl leading-tight font-normal text-balance md:text-5xl md:leading-14">
            {post.title}
          </h1>
          <p className="text-muted-foreground mt-5 text-lg leading-7 text-pretty">
            {post.description}
          </p>
          <div className="mt-6">
            <BlogAuthor />
          </div>
          <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <BlogMetadata post={post} readingTime />
            <BlogPostMenu
              markdownHref={preview ? undefined : `/blog/${post.slug}/markdown`}
            />
          </div>
        </header>
        {post.image && <BlogImage src={post.image} alt={post.imageAlt!} />}
        <div className="relative">
          <BlogTableOfContents headings={post.headings} />
          <div className="blog-prose">{children}</div>
        </div>
        {!preview && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeBlogJson(blogPostStructuredData(post)),
            }}
          />
        )}
        <footer className="border-border mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <Link href="/blog" className="text-sm underline underline-offset-4">
            ← Back to blog
          </Link>
          <BlogPostMenu
            markdownHref={preview ? undefined : `/blog/${post.slug}/markdown`}
          />
        </footer>
      </article>
      {related.length > 0 && (
        <section
          aria-labelledby="related-posts"
          className="mx-auto mt-20 max-w-180"
        >
          <h2 id="related-posts" className="mb-6 text-3xl font-normal">
            Explore
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {related.map((item) => (
              <BlogCard
                key={item.slug}
                post={summarizeBlogPost(item)}
                showImage
              />
            ))}
          </div>
        </section>
      )}
      <section className="border-border mt-20 flex flex-wrap items-center justify-between gap-6 border-t pt-12">
        <h2 className="text-3xl font-normal text-balance">
          Find the people you need.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <LandingAuthLink
            href={SETUP_SIGN_UP_HREF}
            className={buttonVariants({ size: "sm" })}
          >
            Sign up
          </LandingAuthLink>
          <LandingBookDemoCta variant="outline" size="sm" />
        </div>
      </section>
    </div>
  );
}
