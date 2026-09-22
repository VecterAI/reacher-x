import { getBlogCategory } from "./blogHelpers";

export function classifyBlogRoute(pathname: string): {
  kind: "listing" | "post" | "asset" | "invalid";
  slug?: string;
  category?: string;
} | null {
  if (pathname === "/blog/examples/content") return { kind: "asset" };
  if (pathname === "/blog") return { kind: "listing" };
  if (!pathname.startsWith("/blog/")) return null;
  const parts = pathname.slice(6).split("/");
  if (
    parts.length === 1 &&
    ["feed.xml", "sitemap.md", "opengraph-image"].includes(parts[0])
  )
    return { kind: "asset" };
  if (parts[0] === "category")
    return parts.length === 2 && getBlogCategory(parts[1])
      ? { kind: "listing", category: parts[1] }
      : { kind: "invalid" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[0])) return { kind: "invalid" };
  if (parts.length === 1) return { kind: "post", slug: parts[0] };
  if (parts.length === 2 && ["markdown", "opengraph-image"].includes(parts[1]))
    return { kind: "asset", slug: parts[0] };
  return { kind: "invalid" };
}

export { prefersMarkdown as prefersBlogMarkdown } from "@/shared/lib/urls/contentNegotiationCore";
