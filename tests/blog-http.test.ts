import assert from "node:assert/strict";
import { test } from "node:test";
import { getBlogPosts } from "../features/blog/lib/blogPosts";

if (!process.env.BLOG_TEST_URL) {
  throw new Error(
    "Start a production preview (pnpm start --port 3107), then run BLOG_TEST_URL=http://127.0.0.1:3107 pnpm test:blog:http"
  );
}
const testUrl = new URL(process.env.BLOG_TEST_URL);
if (
  !["http:", "https:"].includes(testUrl.protocol) ||
  testUrl.pathname !== "/" ||
  testUrl.search ||
  testUrl.hash ||
  testUrl.username ||
  testUrl.password
) {
  throw new Error(
    "BLOG_TEST_URL must be an HTTP(S) origin without credentials, a path, query, or fragment"
  );
}
const origin = testUrl.origin;
async function request(path: string, headers?: HeadersInit) {
  return fetch(`${origin}${path}`, { headers, redirect: "manual" });
}

test("anonymous blog index and all category pages return readable HTML", async () => {
  for (const path of [
    "/blog",
    "/blog/category/announcements",
    "/blog/category/perspectives",
    "/blog/category/tutorials",
    "/blog/category/engineering",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type")!, /text\/html/);
    const html = await response.text();
    assert.match(html, /<h1/);
    assert.match(html, /id="blog-content" tabindex="-1"/);
    assert.doesNotMatch(html, /Authoring example — not published/);
    assert.ok(html.includes('href="/blog/'), path);
    if (path === "/blog") assert.match(html, /<title>Blog<\/title>/);
  }
});

test("all published articles expose content, metadata, JSON-LD and unique PNG images", async () => {
  const images = new Set<string>();
  for (const post of await getBlogPosts()) {
    const response = await request(`/blog/${post.slug}`);
    assert.equal(response.status, 200, post.slug);
    const html = await response.text();
    assert.ok(html.includes(post.title.replace(/&/g, "&amp;")), post.slug);
    assert.match(html, /property="og:type" content="article"/);
    assert.ok(html.includes(`https://reacherx.com/blog/${post.slug}`));
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    const json = html.match(
      /<script type="application\/ld\+json">([^<]+)<\/script>/
    )?.[1];
    assert.ok(json, post.slug);
    assert.equal(JSON.parse(json)["@type"], "BlogPosting");
    for (const heading of post.headings)
      assert.ok(html.includes(`id="${heading.id}"`), heading.id);
    const image = await request(`/blog/${post.slug}/opengraph-image`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type")!, /image\/png/);
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.readUInt32BE(16), 1200);
    assert.equal(bytes.readUInt32BE(20), 630);
    images.add(bytes.toString("base64"));
  }
  assert.equal(images.size, (await getBlogPosts()).length);
});

test("draft, unknown, malformed and invalid category URLs return actual HTTP 404", async () => {
  for (const path of [
    "/blog/authoring-example",
    "/blog/authoring-example/markdown",
    "/blog/authoring-example/opengraph-image",
    "/blog/not-a-post",
    "/blog/category/no-such-category",
    "/blog/a/b/c",
    "/blog/UPPERCASE",
    "/blog/not-a-post.png",
    "/blog/not-a-post.html",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /private draft demonstrating/);
  }
});

test("Markdown negotiation is readable, respects quality, and varies by Accept", async () => {
  const slug = "reacherx-v3-public-beta";
  const direct = await request(`/blog/${slug}/markdown`);
  assert.equal(direct.status, 200);
  const markdown = await direct.text();
  assert.match(markdown, /^# ReacherX v3.0 is now in public beta/);
  assert.match(markdown, /Keyword suggestions|keyword suggestions/);
  assert.doesNotMatch(markdown, /<BlogImage|<BlogCallout/);
  const negotiated = await request(`/blog/${slug}`, {
    Accept: "text/markdown, text/html",
  });
  assert.equal(await negotiated.text(), markdown);
  assert.match(negotiated.headers.get("vary")!, /Accept/i);
  const html = await request(`/blog/${slug}`, {
    Accept: "text/markdown;q=0, text/html",
  });
  assert.match(html.headers.get("content-type")!, /text\/html/);
  const wildcard = await request(`/blog/${slug}`, {
    Accept: "text/markdown;q=0.5,*/*;q=1",
  });
  assert.match(wildcard.headers.get("content-type")!, /text\/html/);
});

test("feeds and sitemap contain published URLs and exclude drafts", async () => {
  for (const path of [
    "/blog/feed.xml",
    "/blog/sitemap.md",
    "/sitemap.xml",
    "/llms.txt",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const content = await response.text();
    assert.match(content, /reacherx-v3-public-beta/);
    assert.doesNotMatch(content, /authoring-example/);
  }
  const robots = await request("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Allow: \//);
  const search = await request("/blog?q=targeting");
  assert.equal(search.headers.get("x-robots-tag"), "noindex, follow");
});

test("existing private routes still redirect anonymous requests to authentication", async () => {
  const response = await request("/agent/setup");
  assert.ok([302, 303, 307, 308].includes(response.status));
  assert.ok(response.headers.get("location"));
});

test("wide tables preserve column headers, numeric alignment, and keyboard access", async () => {
  const response = await request("/blog/example-weekly-review");
  assert.equal(response.status, 200);
  const html = await response.text();
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)];
  assert.equal(tables.length, 2);
  assert.match(
    html,
    /role="region" aria-label="Scrollable table" tabindex="0"/
  );
  const headers = [...tables[0][1].matchAll(/<th\b([^>]*)>/g)];
  assert.equal(headers.length, 6);
  assert.ok(
    headers.every(([, attributes]) => attributes.includes('scope="col"'))
  );
  assert.match(tables[0][1], /text-align:right[^>]*blog-table-number/);
  assert.match(tables[0][1], /1,280/);
  assert.match(tables[0][1], /No conversations collected yet/);
});

test("footnotes have valid reference and return targets and short posts omit contents", async () => {
  const html = await (
    await request("/blog/example-context-before-reply")
  ).text();
  const reference = html.match(
    /<a href="#([^"]+)" id="([^"]+)" data-footnote-ref/
  );
  assert.ok(reference);
  assert.ok(html.includes(`id="${reference[1]}"`));
  assert.ok(html.includes(`href="#${reference[2]}" data-footnote-backref`));
  assert.match(html, /data-footnotes/);
  const shortPost = await (await request("/blog/example-field-note")).text();
  assert.doesNotMatch(shortPost, /aria-label="On this page"/);
});

test("the public preview has media, is noindex, and stays out of discovery", async () => {
  const response = await request("/blog/examples/content");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /reading-demo.mp4/);
  assert.match(html, /reading-demo.vtt/);
  assert.match(html, /Play animation/);
  assert.match(html, /media-theme/);
  assert.doesNotMatch(html, /href="\/blog\/category\/engineering"/);
  assert.match(html, />audience\.ts<\/span>/);
  for (const asset of ["png", "gif", "mp4", "vtt"]) {
    const media = await request(`/blog-media/reading-demo.${asset}`);
    assert.equal(media.status, 200, asset);
    assert.ok((await media.arrayBuffer()).byteLength > 0);
  }
  const videoRange = await request("/blog-media/reading-demo.mp4", {
    Range: "bytes=0-99",
  });
  assert.equal(videoRange.status, 206);
  assert.equal((await videoRange.arrayBuffer()).byteLength, 100);
  for (const path of [
    "/blog/feed.xml",
    "/blog/sitemap.md",
    "/sitemap.xml",
    "/llms.txt",
  ]) {
    assert.doesNotMatch(
      await (await request(path)).text(),
      /examples\/content|content-preview/
    );
  }
  for (const path of [
    "/blog/examples/secret",
    "/blog/examples/content/markdown",
  ])
    assert.equal((await request(path)).status, 404);
});

test("original release videos stream anonymously from the site", async () => {
  const html = await (await request("/blog/reacherx-v3-public-beta")).text();
  assert.doesNotMatch(html, /video\.twimg\.com/);
  const clips = [
    "walkthrough",
    "keywords",
    "exact-match",
    "reply",
    "workspace",
    "pinned-searches",
    "filters",
    "feedback",
  ];
  for (const clip of clips) {
    const path = `/blog-media/reacherx-v3/${clip}.mp4`;
    assert.ok(html.includes(path), path);
    const response = await request(path, { Range: "bytes=0-99" });
    assert.equal(response.status, 206, path);
    assert.match(response.headers.get("content-type") ?? "", /video\/mp4/);
    assert.equal((await response.arrayBuffer()).byteLength, 100, path);
  }
  assert.equal(
    (await request("/blog-media/reacherx-v3/missing.mp4")).status,
    404
  );
});

test("article task checkboxes have visible native labels", async () => {
  const response = await request("/blog/example-targeting-brief");
  assert.equal(response.status, 200);
  const html = await response.text();
  const labels = [
    ...html.matchAll(/<label><input type="checkbox"[^>]*>(.*?)<\/label>/g),
  ];
  assert.equal(labels.length, 4);
  assert.ok(labels[0][1].includes("The role is clear."));
  assert.ok(
    labels[3][1].includes("Someone else can explain the brief in one sentence.")
  );
});
