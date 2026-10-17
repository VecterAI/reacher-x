// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

const actionMock = vi.hoisted(() => vi.fn());

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function () {
    return { action: actionMock };
  }),
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { getPublicTestimonials } from "./getPublicTestimonials";
import { MOCK_PUBLIC_TESTIMONIALS } from "./mockPublicTestimonials";

const realEnv = { ...process.env };

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  process.env = { ...realEnv };
  vi.clearAllMocks();
});

test("production never serves the local fixtures; an empty feed hides the section", async () => {
  setNodeEnv("production");
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  process.env.LANDING_USE_MOCK_TESTIMONIALS = "";
  actionMock.mockResolvedValue({ tweets: [] });
  const tweets = await getPublicTestimonials(8);
  expect(actionMock).toHaveBeenCalledTimes(1);
  // An unavailable feed resolves empty so the section renders nothing.
  expect(tweets).toEqual([]);
});

test("development serves the local fixtures without contacting the provider", async () => {
  setNodeEnv("development");
  const tweets = await getPublicTestimonials(4);
  expect(tweets).toEqual(MOCK_PUBLIC_TESTIMONIALS.slice(0, 4));
  expect(actionMock).not.toHaveBeenCalled();
});

test("LANDING_USE_MOCK_TESTIMONIALS=1 opts into fixtures outside development", async () => {
  setNodeEnv("production");
  process.env.LANDING_USE_MOCK_TESTIMONIALS = "1";
  const tweets = await getPublicTestimonials(2);
  expect(tweets).toEqual(MOCK_PUBLIC_TESTIMONIALS.slice(0, 2));
  expect(actionMock).not.toHaveBeenCalled();
});
