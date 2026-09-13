import type { Metadata } from "next";
import {
  BLOG_AUTHOR,
  BLOG_DESCRIPTION,
  BLOG_ORIGIN,
  blogHref,
  blogImageUrl,
  type BlogPostSummary,
} from "./blogHelpers";

export function blogListingMetadata(
  title = "Blog",
  pathname = "/blog",
  description = BLOG_DESCRIPTION
): Metadata {
  return {
    metadataBase: new URL(BLOG_ORIGIN),
    title: `${title} | ReacherX`,
    description,
    alternates: {
      canonical: `${BLOG_ORIGIN}${pathname}`,
      types: { "application/rss+xml": `${BLOG_ORIGIN}/blog/feed.xml` },
    },
    openGraph: {
      title: `${title} | ReacherX`,
      description,
      url: `${BLOG_ORIGIN}${pathname}`,
      siteName: "ReacherX",
      type: "website",
      images: [{ url: `${BLOG_ORIGIN}/og-default.jpg` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ReacherX`,
      description,
      images: [`${BLOG_ORIGIN}/og-default.jpg`],
    },
  };
}

export function blogPostMetadata(post: BlogPostSummary): Metadata {
  const url = `${BLOG_ORIGIN}${blogHref(post.slug)}`;
  return {
    metadataBase: new URL(BLOG_ORIGIN),
    title: `${post.title} | ReacherX`,
    description: post.description,
    authors: [{ name: BLOG_AUTHOR.name, url: BLOG_AUTHOR.url }],
    alternates: {
      canonical: url,
      types: {
        "text/markdown": `${url}/markdown`,
        "application/rss+xml": `${BLOG_ORIGIN}/blog/feed.xml`,
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      siteName: "ReacherX",
      publishedTime: `${post.date}T00:00:00Z`,
      modifiedTime: `${post.updated ?? post.date}T00:00:00Z`,
      authors: [BLOG_AUTHOR.url],
      tags: post.tags,
      images: [
        { url: blogImageUrl(post), width: 1200, height: 630, alt: post.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [{ url: blogImageUrl(post), alt: post.title }],
    },
  };
}

export function blogPostStructuredData(post: BlogPostSummary) {
  const url = `${BLOG_ORIGIN}${blogHref(post.slug)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: [blogImageUrl(post)],
    datePublished: `${post.date}T00:00:00Z`,
    dateModified: `${post.updated ?? post.date}T00:00:00Z`,
    mainEntityOfPage: url,
    url,
    author: { "@type": "Person", name: BLOG_AUTHOR.name, url: BLOG_AUTHOR.url },
    publisher: { "@type": "Organization", name: "ReacherX", url: BLOG_ORIGIN },
  };
}
