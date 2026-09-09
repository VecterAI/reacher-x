import assert from "node:assert/strict";
import rehypeBlogTaskLists from "../features/blog/lib/rehypeBlogTaskLists.mjs";
import { test } from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateBlogAssets } from "../features/blog/lib/blogAssetHelpers";
import {
  parseBlogPost,
  publicBlogPosts,
  blogBodyMarkdown,
} from "../features/blog/lib/blogContentCore";
import {
  blogMetadataSchema,
  filterBlogPosts,
  formatBlogDate,
  getPublishedBlogCategories,
  serializeBlogJson,
  blogImageUrl,
} from "../features/blog/lib/blogHelpers";
import { getBlogPost, getBlogPosts } from "../features/blog/lib/blogPosts";
import {
  buildBlogRss,
  buildBlogMarkdownIndex,
} from "../features/blog/lib/blogFeeds";
import {
  blogPostMetadata,
  blogPostStructuredData,
} from "../features/blog/lib/blogMetadata";

const meta = {
  title: "A useful post",
  description: "A clear description",
  category: "engineering",
  date: "2026-09-08",
};
const source = (body: string, overrides = {}) =>
  `---\n${JSON.stringify({ ...meta, ...overrides })}\n---\n${body}`;
test("metadata rejects incomplete posts, invalid categories/dates, and inaccessible image paths", () => {
  for (const patch of [
    { title: "" },
    { description: "" },
    { date: "2026-02-30" },
    { category: "unknown" },
    { image: "/../secret.png", imageAlt: "x" },
    { image: "/cover.jpg" },
    { updated: "2020-01-01" },
  ]) {
    assert.equal(
      blogMetadataSchema.safeParse({ ...meta, ...patch }).success,
      false,
      JSON.stringify(patch)
    );
  }
});
test("headings match GitHub slug rules, inline code, and duplicate headings", () => {
  const post = parseBlogPost(
    source("## Hello `world`\n\nContent\n\n## Hello `world`\n\n### Details"),
    "valid-slug"
  );
  assert.deepEqual(
    post.headings.map((h) => h.id),
    ["hello-world", "hello-world-1", "details"]
  );
  assert.equal(post.readingMinutes, 1);
  assert.throws(() => parseBlogPost(source("# Another title"), "valid-slug"));
  assert.throws(() => parseBlogPost(source("## Title"), "../../secret"));
});
test("drafts and future posts are excluded and equal dates sort deterministically", () => {
  const entries = [
    { slug: "z", date: "2026-01-01", draft: false },
    { slug: "a", date: "2026-01-01", draft: false },
    { slug: "draft", date: "2026-01-01", draft: true },
    { slug: "future", date: "2027-01-01", draft: false },
  ];
  assert.deepEqual(
    publicBlogPosts(entries, "2026-09-08").map((p) => p.slug),
    ["a", "z"]
  );
  assert.equal(entries.length, 4);
});
test("search handles case, whitespace, multiple terms, tags, punctuation, and empty matches", () => {
  const post = parseBlogPost(
    source("## Body", { tags: ["Open Source"] }),
    "test"
  );
  assert.equal(filterBlogPosts([post], " OPEN   source ").length, 1);
  assert.equal(filterBlogPosts([post], "useful description").length, 1);
  assert.equal(filterBlogPosts([post], " ").length, 1);
  assert.equal(filterBlogPosts([post], "[.*]").length, 0);
  assert.equal(filterBlogPosts([post], "not-found").length, 0);
});
test("Markdown retains code, tables and component text without executable MDX", () => {
  const output = blogBodyMarkdown(
    '## Heading\n\n<BlogCallout title="Note">\n\nKeep this advice.\n\n</BlogCallout>\n\n<BlogImage src="/demo.png" alt="A demo" caption="Caption" />\n\n```js\nconst x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |'
  );
  assert.match(output, /Keep this advice/);
  assert.match(output, /\*\*Note\*\*/);
  assert.match(output, /\[A demo\]\(\/demo.png\)/);
  assert.match(output, /const x = 1/);
  assert.match(output, /\| A \| B \|/);
  assert.doesNotMatch(output, /BlogCallout|BlogImage/);
});
test("each post has unique social metadata and escaped structured data", () => {
  const a = parseBlogPost(source("## Text"), "first");
  const b = parseBlogPost(source("## Text"), "second");
  assert.notEqual(blogImageUrl(a), blogImageUrl(b));
  assert.equal(
    blogPostMetadata(a).alternates?.canonical,
    "https://reacherx.com/blog/first"
  );
  assert.equal(blogPostStructuredData(a).datePublished, "2026-09-08T00:00:00Z");
  assert.doesNotMatch(
    serializeBlogJson({ title: "</script><script>bad</script>" }),
    /<\/script>/
  );
  assert.equal(
    blogImageUrl({ ...a, ogImage: "/custom.png" }),
    "https://reacherx.com/custom.png"
  );
});
test("feeds escape XML special characters and publish stable canonical URLs", () => {
  const post = parseBlogPost(
    source("## Text", {
      title: "A & B < C",
      description: 'Text with "quotes"',
    }),
    "feed-post"
  );
  const rss = buildBlogRss([post]);
  assert.match(rss, /A &amp; B &lt; C/);
  assert.match(rss, /&quot;quotes&quot;/);
  assert.match(rss, /https:\/\/reacherx.com\/blog\/feed-post/);
});
test("all shipped posts parse and private drafts never appear in discovery", async () => {
  const posts = await getBlogPosts();
  assert.ok(posts.length >= 3);
  assert.equal(await getBlogPost("authoring-example"), undefined);
  assert.equal(await getBlogPost("../package"), undefined);
  assert.doesNotMatch(
    buildBlogRss(posts) + buildBlogMarkdownIndex(posts),
    /authoring-example/
  );
});
test("public routing covers blog and discovery without broadening private app access", async () => {
  const proxy = await readFile("proxy.ts", "utf8");
  const block = proxy.match(/const PUBLIC_PATH_PATTERNS = \[([\s\S]*?)\];/)![1];
  const patterns = Array.from(
    block.matchAll(/\/(.+)\/,/g),
    (match) => new RegExp(match[1])
  );
  for (const url of [
    "/blog",
    "/blog/example",
    "/blog/example/opengraph-image",
    "/blog/feed.xml",
    "/blog/category/tutorials",
    "/robots.txt",
    "/sitemap.xml",
    "/llms.txt",
  ])
    assert.ok(
      patterns.some((pattern) => pattern.test(url)),
      url
    );
  for (const url of [
    "/blog-private",
    "/agent/setup",
    "/workspace",
    "/api/private",
  ])
    assert.equal(
      patterns.some((pattern) => pattern.test(url)),
      false,
      url
    );
});

test("blog route classification and content negotiation fail closed", async () => {
  const { classifyBlogRoute, prefersBlogMarkdown } =
    await import("../features/blog/lib/blogRouteCore");
  assert.equal(classifyBlogRoute("/blog/category/tutorials")?.kind, "listing");
  assert.equal(classifyBlogRoute("/blog/category/unknown")?.kind, "invalid");
  assert.equal(classifyBlogRoute("/blog/a/extra/deep")?.kind, "invalid");
  assert.equal(classifyBlogRoute("/blogger"), null);
  assert.equal(classifyBlogRoute("/blog/a/markdown")?.slug, "a");
  assert.equal(prefersBlogMarkdown("text/markdown,text/html"), true);
  assert.equal(prefersBlogMarkdown("text/html,text/markdown"), false);
  assert.equal(prefersBlogMarkdown("text/markdown;q=0,text/html"), false);
  assert.equal(
    prefersBlogMarkdown("text/markdown;q=0.5,text/html;q=0.9"),
    false
  );
  assert.equal(prefersBlogMarkdown("text/markdown;q=wat"), false);
  assert.equal(prefersBlogMarkdown("text/markdown;q=0.5,*/*;q=1"), false);
  assert.equal(prefersBlogMarkdown("text/*;q=1,text/html;q=0"), true);
  assert.equal(prefersBlogMarkdown("text/markdown;q=0,*/*;q=1"), false);
  assert.equal(prefersBlogMarkdown("*/*"), false);
  assert.equal(prefersBlogMarkdown("text/markdown ;Q=1,text/html;q=0.5"), true);
});

test("launch articles preserve dates, source threads, and editorial categories", async () => {
  const posts = (await getBlogPosts()).filter(
    (post) => !post.slug.startsWith("example-")
  );
  assert.deepEqual(
    posts.map(({ slug, date, category }) => ({ slug, date, category })),
    [
      {
        slug: "reacherx-v3-public-beta",
        date: "2025-10-13",
        category: "announcements",
      },
      {
        slug: "why-finding-customers-is-hard",
        date: "2025-03-22",
        category: "perspectives",
      },
      {
        slug: "finding-customers-should-be-easier",
        date: "2025-03-18",
        category: "announcements",
      },
    ]
  );
  for (const post of posts) {
    assert.match(post.content, /https:\/\/www.reacherx.com\/threads\/\d+/);
    assert.doesNotMatch(post.content, /#buildinpublic/);
  }
  assert.equal(await getBlogPost("content-preview"), undefined);
});

test("GIF Markdown preserves its description, source, and caption", () => {
  const markdown = blogBodyMarkdown(
    '<BlogGif src="/demo.gif" poster="/demo.png" alt="Workflow" caption="Three steps" />'
  );
  assert.match(markdown, /\[Workflow\]\(\/demo.gif\)/);
  assert.match(markdown, /Three steps/);
  assert.doesNotMatch(markdown, /BlogGif/);
});

test("date formatting rejects invalid dates instead of silently showing today", () => {
  assert.equal(formatBlogDate("2025-10-13"), "Oct 13, 2025");
  assert.throws(() => formatBlogDate("2026-02-30"), RangeError);
  assert.throws(() => formatBlogDate(""), RangeError);
});

test("category navigation is derived from published content, independently of search", () => {
  const posts = [
    parseBlogPost(source("Text", { category: "announcements" }), "launch"),
    parseBlogPost(source("Text", { category: "perspectives" }), "opinion"),
  ];
  assert.deepEqual(
    getPublishedBlogCategories(posts).map((item) => item.slug),
    ["announcements", "perspectives"]
  );
  assert.deepEqual(getPublishedBlogCategories([]), []);
  assert.equal(filterBlogPosts(posts, "no-match").length, 0);
  assert.equal(getPublishedBlogCategories(posts).length, 2);
});

test("build-time asset validation accepts optional covers and rejects missing cover or social files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "blog-assets-"));
  try {
    await validateBlogAssets([{ slug: "no-cover" }], directory);
    await assert.rejects(
      validateBlogAssets([{ slug: "cover", image: "/cover.png" }], directory),
      /cover: missing asset \/cover.png/
    );
    await writeFile(path.join(directory, "cover.png"), "fixture");
    await validateBlogAssets(
      [{ slug: "cover", image: "/cover.png" }],
      directory
    );
    await assert.rejects(
      validateBlogAssets(
        [{ slug: "social", image: "/cover.png", ogImage: "/social.png" }],
        directory
      ),
      /social: missing asset \/social.png/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("task labels preserve inline formatting and exclude nested task lists", () => {
  for (const loose of [false, true]) {
    const checkbox = {
      type: "element",
      tagName: "input",
      properties: { type: "checkbox", disabled: true, checked: true },
      children: [],
    };
    const text = { type: "text", value: " Review " };
    const emphasis = {
      type: "element",
      tagName: "em",
      properties: {},
      children: [{ type: "text", value: "carefully" }],
    };
    const nested = {
      type: "element",
      tagName: "ul",
      properties: {},
      children: [],
    };
    const content = [checkbox, text, emphasis];
    const container = loose
      ? { type: "element", tagName: "p", properties: {}, children: content }
      : null;
    const item = {
      type: "element",
      tagName: "li",
      properties: { className: ["task-list-item"] },
      children: container ? [container, nested] : [...content, nested],
    };
    const tree = { type: "root", children: [item] };
    rehypeBlogTaskLists()(tree);
    const expectedLabel = {
      type: "element",
      tagName: "label",
      properties: {},
      children: [checkbox, text, emphasis],
    };
    assert.deepEqual((container ?? item).children[0], expectedLabel);
    assert.equal(item.children.at(-1), nested);
    // A repeated compiler pass must not wrap an already-labelled checkbox again.
    const once = JSON.stringify(tree);
    rehypeBlogTaskLists()(tree);
    assert.equal(JSON.stringify(tree), once);
  }
});
