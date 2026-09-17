import assert from "node:assert/strict";
import test from "node:test";
import {
  publicPageMarkdown,
  buildAgentReadingIndex,
} from "../features/landing/lib/agentReadinessCore";
import {
  PUBLIC_MARKETING_PAGES,
  publicMarkdownHref,
  marketingStructuredData,
} from "../features/landing/lib/agentReadinessHelpers";
import { getBlogPosts } from "../features/blog/lib/blogPosts";
import {
  getPublishedBlogCategories,
  BLOG_ORIGIN,
} from "../features/blog/lib/blogHelpers";
import {
  homepageFaqItems,
  pricingFaqItems,
} from "../features/landing/lib/faqs";
import { ONBOARDING_PLAN_TIERS } from "../features/agent/ui/components/onboarding/planStepConfig";
import { prefersMarkdown } from "../shared/lib/urls/contentNegotiationCore";

test("content negotiation respects exclusions, wildcard specificity, quality and order", () => {
  for (const [accept, expected] of [
    ["", false],
    ["*/*", false],
    ["text/html", false],
    ["text/markdown", true],
    ["TEXT/MARKDOWN; Q=1, text/html;q=.5", true],
    ["text/markdown;q=0,*/*", false],
    ["text/*;q=1,text/html;q=0", true],
    ["text/markdown;q=.5,*/*;q=1", false],
    ["text/html,text/markdown", false],
    ["text/markdown,text/html", true],
    ["text/markdown;q=wat", false],
    ["text/markdown;q=-1", false],
    ["text/markdown;q=2", false],
    ["application/json", false],
    ["text/markdown;q=0,text/html;q=0", false],
  ] as const)
    assert.equal(prefersMarkdown(accept), expected, accept);
});

test("only public editorial routes can resolve to Markdown; private and adversarial paths cannot", async () => {
  const posts = await getBlogPosts();
  for (const path of [
    "/",
    "/agent/setup",
    "/settings",
    "/threads",
    "/api",
    "/home/preview",
    "/home/v2",
    "/blog/authoring-example",
    "/use-cases/__proto__",
    "/use-cases/investors/extra",
    "/home/../agent/setup",
    "/blog/category/constructor",
    "/blog/category/tutorials/extra",
  ]) {
    assert.equal(publicMarkdownHref(path), null, path);
    assert.equal(publicPageMarkdown(path, posts), null, path);
  }
  assert.equal(publicPageMarkdown("/blog/category/tutorials", []), null);
});

test("every public page and populated blog category has a described Markdown representation", async () => {
  const posts = await getBlogPosts();
  const paths = [
    ...PUBLIC_MARKETING_PAGES.map((page) => page.href),
    "/blog",
    ...getPublishedBlogCategories(posts).map(
      (category) => `/blog/category/${category.slug}`
    ),
  ];
  for (const path of paths) {
    const markdown = publicPageMarkdown(path, posts);
    assert.ok(markdown && markdown.length > 500, path);
    assert.ok(markdown.includes(`Canonical: ${BLOG_ORIGIN}${path}`));
    assert.ok(publicMarkdownHref(path));
  }
  const index = buildAgentReadingIndex(posts);
  for (const path of paths)
    assert.ok(index.includes(`${BLOG_ORIGIN}${path}`), path);
  for (const post of posts)
    assert.ok(index.includes(`/blog/${post.slug})`), post.slug);
  assert.doesNotMatch(index, /authoring-example|private draft/);
});

test("FAQ answers and monthly/yearly plan amounts remain consistent across formats", async () => {
  const posts = await getBlogPosts();
  for (const path of ["/home", "/product"]) {
    const md = publicPageMarkdown(path, posts)!;
    for (const faq of homepageFaqItems)
      assert.ok(md.includes(faq.answer), faq.id);
  }
  const pricing = publicPageMarkdown("/pricing", posts)!;
  for (const faq of pricingFaqItems)
    assert.ok(pricing.includes(faq.answer), faq.id);
  for (const tier of ONBOARDING_PLAN_TIERS) {
    for (const period of ["monthly", "yearly"] as const)
      assert.ok(
        pricing.includes(`$${tier.pricing[period].amount!.toFixed(2)}`)
      );
    for (const feature of tier.features) assert.ok(pricing.includes(feature));
  }
});

test("blog Markdown search respects category and has a truthful empty state", async () => {
  const posts = await getBlogPosts();
  const body = publicPageMarkdown("/blog/category/tutorials", posts)!;
  for (const post of posts)
    assert.equal(
      body.includes(`/blog/${post.slug})`),
      post.category === "tutorials"
    );
  assert.match(
    publicPageMarkdown("/blog", posts, "no-such-result-xyz")!,
    /No posts match/
  );
});

test("structured data describes public identity without invented ratings or addresses", () => {
  for (const page of PUBLIC_MARKETING_PAGES) {
    const graph = marketingStructuredData(page.href)!;
    assert.equal(graph["@context"], "https://schema.org");
    assert.ok(JSON.stringify(graph).includes(`${BLOG_ORIGIN}${page.href}`));
    assert.doesNotMatch(
      JSON.stringify(graph),
      /aggregateRating|PostalAddress|apiKey/
    );
  }
});
