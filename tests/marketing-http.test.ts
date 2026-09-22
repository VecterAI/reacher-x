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

test("all use case guides are publicly rendered and ready to start a relevant search", async () => {
  for (const item of MARKETING_USE_CASES) {
    const response = await request(item.blogHref);
    assert.equal(response.status, 200, item.blogHref);
    const html = await response.text();
    assert.match(html, /<h1/);
    assert.ok(html.includes(`https://reacherx.com${item.blogHref}`));
    assert.doesNotMatch(
      html,
      /NEXT_HTTP_ERROR_FALLBACK;500|Internal Server Error/
    );
  }
});

test("the approved homepage is canonical and indexable", async () => {
  const response = await request("/home");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Agent that finds the right people for your goals/);
  assert.match(html, /Describe who you need △ Agent to find/);
  assert.match(html, /rel="canonical" href="https:\/\/reacherx.com\/home"/);
  assert.doesNotMatch(
    html,
    /noindex|Network homepage preview|Compare homepage designs|Building got easy/
  );
});

test("retired variant URLs return 404 without redirects", async () => {
  for (const path of [
    "/home/v0",
    "/home/v2",
    "/home/v2/nested",
    "/home/preview",
    "/home/preview/network",
    "/home/preview/network?utm_source=old",
    "/home/preview/missing.png",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("location"), null, path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex", path);
  }
});

test("removed routes no longer exist and retired variants stay 404", async () => {
  for (const path of ["/use-cases", "/use-cases/customers", "/product"])
    assert.equal((await request(path)).status, 404, path);
  for (const path of [
    "/about",
    "/home/preview/not-real",
    "/home/preview/describe",
    "/home/preview/goals",
    "/home/preview/__proto__",
  ])
    assert.equal((await request(path)).status, 404, path);
  // Retired threads retain the existing protected-path behavior for anonymous users.
  assert.equal((await request("/threads")).status, 307);
  const legacy = await request("/home/use-cases");
  assert.equal(legacy.status, 308);
  assert.equal(
    new URL(legacy.headers.get("location")!, origin).pathname,
    "/home"
  );
});
