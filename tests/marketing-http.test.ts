import assert from "node:assert/strict";
import test from "node:test";
import { MARKETING_USE_CASES } from "../features/landing/lib/marketingUseCaseHelpers";

const origin = process.env.MARKETING_TEST_URL;
if (!origin)
  throw new Error(
    "Set MARKETING_TEST_URL to the running production preview origin."
  );
const request = (path: string) =>
  fetch(new URL(path, origin), { redirect: "manual" });

test("all use cases are publicly rendered, canonical, and ready to start a relevant search", async () => {
  for (const item of MARKETING_USE_CASES) {
    const response = await request(item.href);
    assert.equal(response.status, 200, item.href);
    const html = await response.text();
    assert.match(html, /<h1/);
    assert.ok(html.includes(`https://reacherx.com${item.href}`));
    assert.ok(html.includes(`/blog/${item.guide}`));
    assert.doesNotMatch(html, /example-brief-heading|Other use cases/);
    assert.doesNotMatch(
      html,
      /NEXT_HTTP_ERROR_FALLBACK;500|Internal Server Error/
    );
  }
});

test("Network is the only preview, has a composer, and has no comparison links", async () => {
  const response = await request("/home/preview/network");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /Describe who you need Agent to find/);
  assert.doesNotMatch(
    html,
    /Compare homepage designs|Design previews|preview\/describe|preview\/goals/
  );
  const index = await request("/home/preview");
  assert.equal(index.status, 307);
  assert.equal(
    new URL(index.headers.get("location")!, origin).pathname,
    "/home/preview/network"
  );
});

test("public supporting pages and removed or invalid routes have the right status", async () => {
  for (const path of ["/use-cases", "/product", "/about"])
    assert.equal((await request(path)).status, 200, path);
  for (const path of [
    "/use-cases/not-real",
    "/home/preview/not-real",
    "/home/preview/describe",
    "/home/preview/goals",
    "/use-cases/customers/extra",
    "/use-cases/missing.png",
    "/home/preview/__proto__",
  ])
    assert.equal((await request(path)).status, 404, path);
  // Retired threads retain the existing protected-path behavior for anonymous users.
  assert.equal((await request("/threads")).status, 307);
  const legacy = await request("/home/use-cases");
  assert.equal(legacy.status, 308);
  assert.equal(
    new URL(legacy.headers.get("location")!, origin).pathname,
    "/use-cases"
  );
});
