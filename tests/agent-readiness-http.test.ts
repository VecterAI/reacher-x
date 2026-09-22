import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { getBlogPosts } from "../features/blog/lib/blogPosts";
import {
  BLOG_ORIGIN,
  getPublishedBlogCategories,
} from "../features/blog/lib/blogHelpers";
import { PUBLIC_MARKETING_PAGES } from "../features/landing/lib/agentReadinessHelpers";
import {
  homepageFaqItems,
  pricingFaqItems,
} from "../features/landing/lib/faqs";

const value = process.env.AGENT_TEST_URL;
if (!value)
  throw new Error("Set AGENT_TEST_URL to a running production build.");
const origin = new URL(value);
if (
  !/^https?:$/.test(origin.protocol) ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
)
  throw new Error("AGENT_TEST_URL must be an HTTP(S) origin.");
const request = (path: string, headers: HeadersInit = {}, method = "GET") =>
  fetch(new URL(path, origin), { headers, method, redirect: "manual" });
const htmlDocument = (html: string) => {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  window.document.body.innerHTML = html;
  window.document
    .querySelectorAll("script,style")
    .forEach((node) => node.remove());
  return window;
};

test("all canonical pages have readable HTML, discoverable Markdown, and matching content", async () => {
  const posts = await getBlogPosts();
  const paths = [
    ...PUBLIC_MARKETING_PAGES.map((page) => page.href),
    "/blog",
    ...getPublishedBlogCategories(posts).map(
      (category) => `/blog/category/${category.slug}`
    ),
    ...posts.map((post) => `/blog/${post.slug}`),
  ];
  for (const path of paths) {
    const response = await request(path, { "User-Agent": "Claude-User/1.0" });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type")!, /text\/html/);
    assert.match(response.headers.get("vary")!, /accept/i, path);
    const html = await response.text();
    assert.doesNotMatch(
      html,
      /data-dgst="[^"]+"|NEXT_HTTP_ERROR_FALLBACK;500/,
      path
    );
    const window = htmlDocument(html);
    const doc = window.document;
    assert.ok(doc.querySelector("h1")?.textContent?.trim(), path);
    assert.ok(doc.body.textContent.length > 300, path);
    assert.equal(
      doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      `${BLOG_ORIGIN}${path}`,
      path
    );
    const alternate = doc
      .querySelector('link[rel="alternate"][type="text/markdown"]')
      ?.getAttribute("href");
    assert.ok(alternate, path);
    assert.match(
      response.headers.get("link")!,
      /rel="alternate"; type="text\/markdown"/
    );
    const direct = await request(new URL(alternate).pathname);
    const negotiated = await request(path, { Accept: "text/markdown" });
    assert.equal(direct.status, 200, alternate);
    assert.equal(negotiated.status, 200, path);
    assert.match(negotiated.headers.get("content-type")!, /^text\/markdown/);
    assert.match(negotiated.headers.get("vary")!, /accept/i);
    const markdown = await negotiated.text();
    assert.equal(markdown, await direct.text(), path);
    assert.ok(markdown.startsWith("# "), path);
    assert.ok(markdown.includes(`Canonical: ${BLOG_ORIGIN}${path}`), path);
    if (["/home", "/pricing"].includes(path)) {
      for (const faq of path === "/pricing"
        ? pricingFaqItems
        : homepageFaqItems) {
        assert.ok(
          doc.querySelector("main")!.textContent.includes(faq.answer),
          `${path}: ${faq.id} in raw HTML`
        );
        assert.ok(
          markdown.includes(faq.answer),
          `${path}: ${faq.id} in Markdown`
        );
      }
    }
    await window.happyDOM.close();
  }
  console.log(
    `Verified ${paths.length} canonical pages in HTML, negotiated Markdown and direct Markdown.`
  );
});

test("format switching, HEAD and RSC requests preserve representation boundaries", async () => {
  for (const path of [
    "/home",
    "/pricing",
    "/blog",
    "/blog/reach-out-and-get-replies",
  ]) {
    for (const [accept, type] of [
      ["text/markdown", "text/markdown"],
      ["text/html", "text/html"],
      ["text/markdown;q=0,text/html", "text/html"],
      ["text/markdown;q=.5,*/*;q=1", "text/html"],
      ["text/markdown,text/html", "text/markdown"],
      ["*/*", "text/html"],
    ]) {
      const response = await request(path, { Accept: accept });
      assert.equal(response.status, 200, path);
      assert.ok(
        response.headers.get("content-type")!.startsWith(type),
        `${path}: ${accept}`
      );
      await response.arrayBuffer();
    }
    const head = await request(path, { Accept: "text/markdown" }, "HEAD");
    assert.equal(head.status, 200);
    assert.match(head.headers.get("content-type")!, /text\/markdown/);
    assert.equal(await head.text(), "");
    const rsc = await request(path, { RSC: "1", Accept: "text/markdown" });
    assert.match(rsc.headers.get("content-type")!, /text\/x-component/);
    assert.doesNotMatch(await rsc.text(), /\b[0-9a-f]+:E\{"digest":/);
  }
});

test("invalid Markdown paths cannot expose private routes, drafts or source files", async () => {
  for (const path of [
    "/markdown",
    "/markdown/agent/setup",
    "/markdown/settings",
    "/markdown/blog/authoring-example",
    "/markdown/blog/category/not-real",
    "/markdown/blog/category/tutorials/extra",
    "/markdown/use-cases/__proto__",
    "/markdown/home/extra",
    "/markdown/.env.local",
    "/markdown/api",
    "/use-cases/not-real",
    "/blog/authoring-example",
  ]) {
    const response = await request(path, { Accept: "text/markdown" });
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(
      await response.text(),
      /WORKOS_API_KEY|private draft|NEXT_PUBLIC_CONVEX_URL/
    );
  }
  for (const path of ["/agent/setup", "/settings", "/threads"]) {
    const response = await request(path, { Accept: "text/markdown" });
    assert.equal(response.status, 307, path);
    assert.ok(response.headers.get("location"));
  }
});

test("sitemap and reading index enumerate canonical published pages without fabricated dates", async () => {
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1]
  );
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(!urls.includes(BLOG_ORIGIN));
  assert.doesNotMatch(
    xml,
    /authoring-example|\/markdown\/|\/agent\/|\/home\/preview/
  );
  for (const page of PUBLIC_MARKETING_PAGES)
    assert.ok(urls.includes(`${BLOG_ORIGIN}${page.href}`), page.href);
  const llms = await request("/llms.txt");
  assert.equal(llms.status, 200);
  const index = await llms.text();
  assert.match(index, /When to use ReacherX/);
  for (const url of urls) assert.ok(index.includes(url), url);
  const root = await request("/?utm_source=agent-qa", {
    Accept: "text/markdown",
  });
  assert.equal(root.status, 307);
  assert.equal(
    new URL(root.headers.get("location")!, origin).pathname,
    "/home"
  );
  assert.equal(
    new URL(root.headers.get("location")!, origin).search,
    "?utm_source=agent-qa"
  );
});

test("marketing JSON-LD, metadata and crawler policy are present in the raw response", async () => {
  for (const page of PUBLIC_MARKETING_PAGES) {
    const html = await (await request(page.href)).text();
    const graph = JSON.parse(
      html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)![1]
    );
    assert.ok(
      graph["@graph"].some(
        (item: Record<string, string>) => item["@type"] === "Organization"
      )
    );
    assert.ok(
      graph["@graph"].some(
        (item: Record<string, string>) =>
          item["@type"] === "SoftwareApplication"
      )
    );
    assert.match(html, /property="og:type" content="website"/);
    assert.match(html, /name="is-agentic-site-type" content="business"/);
    assert.match(html, /href="\/llms.txt"/);
  }
  const robots = await request("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Allow: \//);
});

test("blog search is preserved through negotiation and never indexed", async () => {
  for (const path of [
    "/blog?q=no-such-result-xyz",
    "/blog/category/tutorials?q=no-such-result-xyz",
  ]) {
    const response = await request(path, { Accept: "text/markdown" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
    assert.match(await response.text(), /No posts match your search/);
  }
});
