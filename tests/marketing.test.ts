import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  MARKETING_USE_CASES,
  isInvalidMarketingPath,
} from "../features/landing/lib/marketingUseCaseHelpers";
import {
  BLOG_DEMO_IDS,
  BLOG_DEMO_SHOTS,
  getBlogDemoPlacement,
} from "../features/blog/lib/blogDemoHelpers";
import {
  publicBlogPosts,
  parseBlogPost,
} from "../features/blog/lib/blogContentCore";

import {
  getDemoUseCaseLabels,
  getDemoWorkspaceUseCaseKey,
} from "../features/landing/ui/components/use-case-demo/demoLabels";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";

test("job-seeker demo labels match the shared recruiting panels", () => {
  const shared = getWorkspaceUseCase(getDemoWorkspaceUseCaseKey("job_seekers"));
  const demo = getDemoUseCaseLabels("job_seekers");
  assert.equal(demo.entityPlural, shared.entityPlural);
  assert.deepEqual(demo.pageLabels, shared.pageLabels);
  assert.deepEqual(demo.stageLabels, shared.stageLabels);
});

test("every public use case has a working demo and published guide", () => {
  for (const item of MARKETING_USE_CASES) {
    assert.ok(item.prompt.trim().length > 30, item.slug);
    assert.ok(BLOG_DEMO_IDS.includes(item.guide), item.guide);
    const path = `content/blog/${item.guide}.mdx`;
    assert.ok(existsSync(path), path);
    assert.equal(
      publicBlogPosts(
        [parseBlogPost(readFileSync(path, "utf8"), item.guide)],
        "2026-09-13"
      ).length,
      1
    );
    assert.ok(item.blogHref.startsWith("/blog/"), item.blogHref);
  }
});

test("unknown and adversarial route values do not resolve to marketing content", () => {
  for (const value of [
    "",
    "__proto__",
    "constructor",
    "../investors",
    "CUSTOMERS",
    "%2Fcustomers",
    "https://example.com",
  ]) {
    assert.equal(isInvalidMarketingPath(`/home/preview/${value}`), true);
  }
  for (const path of ["/use-cases", "/use-cases/customers", "/product"]) {
    assert.equal(existsSync(`app/(landing)/${path.slice(1)}`), false, path);
  }
});

test("marketing links reference real public blog posts and categories", () => {
  for (const path of [
    "features/landing/ui/components/FooterClient.tsx",
    "features/landing/ui/components/marketing/MarketingNavigation.tsx",
    "features/landing/ui/components/marketing/MarketingSections.tsx",
    "features/landing/ui/components/marketing/MarketingProduct.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/"\/blog\/([a-z0-9-]+)"/g)) {
      assert.ok(
        existsSync(`content/blog/${match[1]}.mdx`),
        `${path}: ${match[1]}`
      );
    }
  }
});

test("fixed demos keep the full desktop viewport and ignore every cinematic camera", () => {
  for (const [width, height] of [
    [320, 213],
    [390, 259],
    [768, 510],
    [950, 660],
    [1440, 660],
  ]) {
    const initial = getBlogDemoPlacement(
      width,
      height,
      { x: 640, y: 425, zoom: 1, mobileZoom: 1 },
      "fixed"
    );
    assert.ok(initial.scale > 0 && initial.scale <= 1);
    assert.equal(initial.x, 0, "Visible app must align with the section edge");
    assert.equal(initial.y, 0, "Hover controls must not reserve a layout row");
    assert.ok(initial.x + 1280 * initial.scale <= width);
    assert.ok(initial.y + 850 * initial.scale <= height);
    for (const shots of Object.values(BLOG_DEMO_SHOTS)) {
      for (const shot of shots)
        assert.deepEqual(
          getBlogDemoPlacement(width, height, shot.camera, "fixed"),
          initial
        );
    }
  }
});

test("only the canonical homepage remains; variants have no routes", () => {
  assert.equal(isInvalidMarketingPath("/home"), false);
  for (const path of [
    "/home/v0",
    "/home/v2",
    "/home/v3",
    "/home/preview",
    "/home/preview/network",
    "/home/preview/goals",
    "/product",
    "/use-cases",
    "/use-cases/customers",
    "/use-cases/customers/extra",
  ]) {
    assert.equal(isInvalidMarketingPath(path), true, path);
  }
  for (const path of [
    "app/home/(landing)/v0",
    "app/home/(landing)/v2",
    "app/home/(landing)/preview",
    "features/landing/ui/components/variants",
    "features/landing/lib/landingVariants.ts",
  ]) {
    assert.equal(existsSync(path), false, path);
  }
});
