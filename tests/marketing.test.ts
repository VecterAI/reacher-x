import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  MARKETING_USE_CASES,
  getMarketingUseCase,
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
  assert.equal(
    new Set(MARKETING_USE_CASES.map((item) => item.href)).size,
    MARKETING_USE_CASES.length
  );
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
    assert.equal(
      getMarketingUseCase(item.slug)?.href,
      `/use-cases/${item.slug}`
    );
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
    assert.equal(getMarketingUseCase(value), undefined);
    assert.equal(isInvalidMarketingPath(`/home/preview/${value}`), true);
  }
});

test("marketing links reference real public blog posts and categories", () => {
  for (const path of [
    "features/landing/ui/components/FooterClient.tsx",
    "features/landing/ui/components/marketing/MarketingNavigation.tsx",
    "features/landing/ui/components/marketing/MarketingSections.tsx",
    "app/(landing)/about/page.tsx",
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

test("only Network resolves as a marketing preview", async () => {
  const { resolveLandingVariantId } =
    await import("../features/landing/lib/landingVariants");
  assert.equal(resolveLandingVariantId("/home/preview"), null);
  assert.equal(resolveLandingVariantId("/home/preview/network"), "network");
  assert.equal(resolveLandingVariantId("/home"), "live");
  assert.equal(isInvalidMarketingPath("/home/preview/network"), false);
  for (const retired of ["describe", "goals"]) {
    const path = `/home/preview/${retired}`;
    assert.equal(resolveLandingVariantId(path), null);
    assert.equal(isInvalidMarketingPath(path), true);
  }
});
