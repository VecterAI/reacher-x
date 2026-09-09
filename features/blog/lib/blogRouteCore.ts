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
  if (parts.length === 1 && ["feed.xml", "sitemap.md"].includes(parts[0]))
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

export function prefersBlogMarkdown(accept: string): boolean {
  const formats = accept
    .toLowerCase()
    .split(",")
    .map((part, index) => {
      const [type, ...parameters] = part.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q=")
      );
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return {
        type: type.trim(),
        q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0,
        index,
      };
    });
  function preference(type: string) {
    // A specific exclusion (q=0) takes precedence over a permissive wildcard.
    for (const range of [type, "text/*", "*/*"]) {
      const matches = formats.filter((format) => format.type === range);
      if (matches.length)
        return matches.reduce((best, item) => (item.q > best.q ? item : best));
    }
    return { q: 0, index: Number.POSITIVE_INFINITY };
  }
  const markdown = preference("text/markdown");
  const html = preference("text/html");
  return (
    markdown.q > 0 &&
    (markdown.q > html.q ||
      (markdown.q === html.q && markdown.index < html.index))
  );
}
