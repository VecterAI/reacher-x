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
  const image = `${BLOG_ORIGIN}/blog/opengraph-image`;
  return {
    metadataBase: new URL(BLOG_ORIGIN),
    title,
    description,
    alternates: {
      canonical: `${BLOG_ORIGIN}${pathname}`,
      types: {
        "application/rss+xml": `${BLOG_ORIGIN}/blog/feed.xml`,
        "text/markdown": `${BLOG_ORIGIN}/markdown${pathname}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${BLOG_ORIGIN}${pathname}`,
      siteName: "ReacherX",
      type: "website",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function blogPostMetadata(post: BlogPostSummary): Metadata {
  const url = `${BLOG_ORIGIN}${blogHref(post.slug)}`;
  return {
    metadataBase: new URL(BLOG_ORIGIN),
    title: post.title,
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
