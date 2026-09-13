import assert from "node:assert/strict";
import { test } from "node:test";
import DemoPage from "@/app/home/demo/[scenario]/page";
import { BLOG_DEMO_IDS } from "@/features/blog/lib/blogDemoHelpers";
import { getBlogDemoUrl } from "@/features/blog/lib/blogDemoUrl";

test("legacy route redirects known stories and invokes notFound for unknown stories", async (t) => {
  const previous = process.env.NEXT_PUBLIC_BLOG_DEMO_ORIGIN;
  process.env.NEXT_PUBLIC_BLOG_DEMO_ORIGIN = "https://demo.example.test";
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BLOG_DEMO_ORIGIN;
    else process.env.NEXT_PUBLIC_BLOG_DEMO_ORIGIN = previous;
  });
  for (const scenario of BLOG_DEMO_IDS) {
    const expected = getBlogDemoUrl(scenario);
    await assert.rejects(
      DemoPage({ params: Promise.resolve({ scenario }) }),
      (error: unknown) =>
        error instanceof Error &&
        "digest" in error &&
        typeof error.digest === "string" &&
        error.digest.startsWith("NEXT_REDIRECT;") &&
        error.digest.includes(expected)
    );
  }
  await assert.rejects(
    DemoPage({ params: Promise.resolve({ scenario: "not-a-story" }) }),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  );
});
