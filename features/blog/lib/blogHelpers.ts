import { z } from "zod";
import { parseIsoToTimestamp } from "@/shared/lib/utils/time/timeUtils";

export const BLOG_ORIGIN = "https://reacherx.com";
export const BLOG_DESCRIPTION =
  "Guides, use cases, comparisons, and notes from building ReacherX. Learn how to find the people you need.";
export const BLOG_CATEGORIES = [
  {
    slug: "tutorials",
    label: "Guides",
    description:
      "Practical guides to finding the people you need with ReacherX.",
  },
  {
    slug: "engineering",
    label: "Engineering",
    description: "Notes on the technology and decisions behind ReacherX.",
  },
  {
    slug: "announcements",
    label: "Updates",
    description: "New releases and updates from ReacherX.",
  },
  {
    slug: "perspectives",
    label: "Founder Notes",
    description: "The experiences, beliefs, and decisions behind ReacherX.",
  },
  {
    slug: "use-cases",
    label: "Use Cases",
    description:
      "Find customers, candidates, investors, partners, and other people you need.",
  },
  {
    slug: "comparisons",
    label: "Comparisons",
    description:
      "Compare ReacherX with other tools for finding and reaching people.",
  },
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["slug"];
export const BLOG_PAGE_SIZE = 9;
export const BLOG_AUTHOR = {
  name: "Salman",
  role: "Founder, ReacherX",
  image: "/landing/founder-story/founder-3.webp",
  url: "https://x.com/ReacherXfounder",
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => parseIsoToTimestamp(`${value}T00:00:00Z`) !== undefined,
    "Use a valid YYYY-MM-DD date"
  );
const localImageSchema = z
  .string()
  .regex(
    /^\/(?!\/)[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|avif)$/,
    "Use a local image in public/"
  );
export const blogMetadataSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(300),
    category: z.enum([
      "tutorials",
      "engineering",
      "announcements",
      "perspectives",
      "use-cases",
      "comparisons",
    ]),
    date: dateSchema,
    updated: dateSchema.optional(),
    related: z
      .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(2)
      .default([]),
    tags: z.array(z.string().trim().min(1)).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    image: localImageSchema.optional(),
    imageAlt: z.string().trim().min(1).optional(),
    ogImage: localImageSchema.optional(),
  })
  .strict()
  .refine(
    (post) => !post.image || !!post.imageAlt,
    "Cover images need imageAlt"
  )
  .refine(
    (post) => !post.updated || post.updated >= post.date,
    "Updated date cannot precede publication"
  );
export type BlogMetadata = z.infer<typeof blogMetadataSchema>;
export type BlogPostSummary = BlogMetadata & {
  slug: string;
  readingMinutes: number;
};
export type BlogHeading = { id: string; text: string; depth: number };

export function getBlogCategory(slug: string) {
  return BLOG_CATEGORIES.find((category) => category.slug === slug);
}
// Use the complete published list, never the current search result, for tabs.
export function getPublishedBlogCategories(
  posts: readonly Pick<BlogPostSummary, "category">[]
) {
  const populated = new Set(posts.map((post) => post.category));
  return BLOG_CATEGORIES.filter((category) => populated.has(category.slug));
}

export function blogHref(slug: string) {
  return `/blog/${slug}`;
}
export function blogCategoryHref(category?: BlogCategory) {
  return category ? `/blog/category/${category}` : "/blog";
}
export function blogImageUrl(post: BlogPostSummary) {
  return `${BLOG_ORIGIN}${post.ogImage ?? `${blogHref(post.slug)}/opengraph-image`}`;
}
const blogDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export function formatBlogDate(date: string) {
  const timestamp = parseIsoToTimestamp(`${date}T00:00:00Z`);
  if (timestamp === undefined)
    throw new RangeError(`Invalid blog date: ${date}`);
  return blogDateFormatter.format(timestamp);
}

export function filterBlogPosts(posts: BlogPostSummary[], query: string) {
  const terms = query
    .trim()
    .toLocaleLowerCase("en")
    .split(/\s+/)
    .filter(Boolean);
  return posts.filter((post) => {
    const haystack =
      `${post.title} ${post.description} ${post.tags.join(" ")}`.toLocaleLowerCase(
        "en"
      );
    return terms.every((term) => haystack.includes(term));
  });
}

export function serializeBlogJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function escapeBlogXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!
  );
}

/** Preserve editorial order, then fill from other published posts. */
export function getRelatedBlogPosts<T extends BlogPostSummary>(
  post: T,
  posts: T[]
): T[] {
  const candidates = posts.filter((candidate) => candidate.slug !== post.slug);
  const selected = post.related.flatMap((slug) => {
    const candidate = candidates.find((item) => item.slug === slug);
    return candidate ? [candidate] : [];
  });
  const selectedSlugs = new Set(selected.map((candidate) => candidate.slug));
  const fallback = candidates
    .filter((candidate) => !selectedSlugs.has(candidate.slug))
    .sort(
      (a, b) =>
        Number(b.category === post.category) -
        Number(a.category === post.category)
    );
  return [
    ...new Map(
      [...selected, ...fallback].map((item) => [item.slug, item])
    ).values(),
  ].slice(0, 2);
}
