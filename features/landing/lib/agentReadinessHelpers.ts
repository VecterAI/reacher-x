import type { Metadata } from "next";
import { BLOG_ORIGIN, getBlogCategory } from "@/features/blog/lib/blogHelpers";
import { MARKETING_USE_CASES } from "./marketingUseCaseHelpers";
import { GITHUB_REPO_URL } from "./github";
import { X_PROFILE_URL, DISCORD_INVITE_URL } from "./communityUrls";
import { homepageFaqItems } from "./faqs";

export const PUBLIC_MARKETING_PAGES = [
  { href: "/home", title: "ReacherX", description: homepageFaqItems[0].answer },
  {
    href: "/product",
    title: "Product",
    description:
      "Discovery, research, outreach plans, conversations, memory, and analytics.",
  },
  {
    href: "/pricing",
    title: "Pricing",
    description: "Paid plans, monthly and yearly prices, and workspace limits.",
  },
  {
    href: "/use-cases",
    title: "Use cases",
    description:
      "Find customers, candidates, investors, partners, creators, community members, research participants, and podcast guests.",
  },
  ...MARKETING_USE_CASES.map((item) => ({
    href: item.href,
    title: item.goal,
    description: item.explanation,
  })),
];

/** Only published editorial routes may have public Markdown representations. */
export function publicMarkdownHref(pathname: string): string | null {
  if (PUBLIC_MARKETING_PAGES.some((page) => page.href === pathname))
    return `/markdown${pathname}`;
  if (pathname === "/blog") return "/markdown/blog";
  const category = pathname.match(/^\/blog\/category\/([^/]+)$/)?.[1];
  if (category && getBlogCategory(category)) return `/markdown${pathname}`;
  return null;
}

export function marketingMetadata(pathname: string): Metadata {
  const page = PUBLIC_MARKETING_PAGES.find((item) => item.href === pathname);
  if (!page) return {};
  const url = `${BLOG_ORIGIN}${pathname}`;
  return {
    metadataBase: new URL(BLOG_ORIGIN),
    title: page.title,
    description: page.description,
    alternates: {
      canonical: url,
      types: {
        "text/markdown": `${BLOG_ORIGIN}${publicMarkdownHref(pathname)}`,
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: "ReacherX",
      type: "website",
      images: [`${BLOG_ORIGIN}/og-default.jpg`],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [`${BLOG_ORIGIN}/og-default.jpg`],
    },
    other: { "is-agentic-site-type": "business" },
  };
}

export function marketingStructuredData(pathname: string) {
  const page = PUBLIC_MARKETING_PAGES.find((item) => item.href === pathname);
  if (!page) return null;
  const organization = `${BLOG_ORIGIN}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: "ReacherX",
        url: BLOG_ORIGIN,
        sameAs: [GITHUB_REPO_URL, X_PROFILE_URL, DISCORD_INVITE_URL],
        contactPoint: {
          "@type": "ContactPoint",
          email: "creativecoder.crco@gmail.com",
          contactType: "customer support",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${BLOG_ORIGIN}/#software`,
        name: "ReacherX",
        url: `${BLOG_ORIGIN}/product`,
        description: homepageFaqItems[0].answer,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisher: { "@id": organization },
      },
      {
        "@type": "WebPage",
        "@id": `${BLOG_ORIGIN}${pathname}`,
        name: page.title,
        description: page.description,
        url: `${BLOG_ORIGIN}${pathname}`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${BLOG_ORIGIN}/#website`,
          name: "ReacherX",
          url: BLOG_ORIGIN,
        },
        about: { "@id": `${BLOG_ORIGIN}/#software` },
      },
    ],
  };
}
