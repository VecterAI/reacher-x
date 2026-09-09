import {
  BLOG_AUTHOR,
  BLOG_DESCRIPTION,
  BLOG_ORIGIN,
  blogHref,
  escapeBlogXml,
  type BlogPostSummary,
} from "./blogHelpers";

export function buildBlogRss(posts: BlogPostSummary[]) {
  const escape = escapeBlogXml;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>ReacherX Blog</title><link>${BLOG_ORIGIN}/blog</link><description>${escape(BLOG_DESCRIPTION)}</description><language>en</language><atom:link href="${BLOG_ORIGIN}/blog/feed.xml" rel="self" type="application/rss+xml"/>${posts.map((post) => `<item><title>${escape(post.title)}</title><link>${BLOG_ORIGIN}${blogHref(post.slug)}</link><guid isPermaLink="true">${BLOG_ORIGIN}${blogHref(post.slug)}</guid><description>${escape(post.description)}</description><category>${post.category}</category><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`;
}

export function buildBlogMarkdownIndex(posts: BlogPostSummary[]) {
  return `# ReacherX Blog\n\n${BLOG_DESCRIPTION}\n\n${posts.map((post) => `- [${post.title}](${BLOG_ORIGIN}${blogHref(post.slug)}/markdown): ${post.description}`).join("\n")}\n`;
}
export function markdownPostHeader(post: BlogPostSummary) {
  return `# ${post.title}\n\n${post.description}\n\nBy ${BLOG_AUTHOR.name} · ${post.date} · ${post.category}\n\nCanonical: ${BLOG_ORIGIN}${blogHref(post.slug)}\n\n`;
}
