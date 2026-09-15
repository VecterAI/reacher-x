// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { MarketingProof } from "./MarketingProof";
import { MOCK_PUBLIC_TESTIMONIALS } from "@/features/landing/lib/mockPublicTestimonials";

vi.mock("@/features/landing/lib/getPublicTestimonials", () => ({
  getPublicTestimonials: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/threads/hooks/useQuotedTweets", () => ({
  useQuotedTweets: () => [],
}));
beforeEach(() => vi.clearAllMocks());
test("development testimonial fixtures are never presented as real endorsements", async () => {
  vi.mocked(getPublicTestimonials).mockResolvedValue(MOCK_PUBLIC_TESTIMONIALS);
  expect(await MarketingProof()).toBeNull();
});
test("an unavailable public feed hides the section rather than inventing quotes", async () => {
  vi.mocked(getPublicTestimonials).mockResolvedValue([]);
  expect(await MarketingProof()).toBeNull();
});
test("public quotes retain attribution and only one accessible copy", async () => {
  const tweet = { ...MOCK_PUBLIC_TESTIMONIALS[0], id_str: "1234567890" };
  vi.mocked(getPublicTestimonials).mockResolvedValue([
    tweet,
    { ...tweet, id_str: "2234567890" },
  ]);
  const html = renderToStaticMarkup(await MarketingProof());
  expect(html).toContain(`/status/${tweet.id_str}`);
  expect(html).toContain('aria-hidden="true" inert=""');
  expect(html).not.toContain("Pause testimonials");
});

test("quote posts render their own text only, without embeds, dates, or metrics", async () => {
  const tweet = {
    ...MOCK_PUBLIC_TESTIMONIALS[0],
    id_str: "1234567890",
    tweet_created_at: "2024-03-27T10:00:00.000Z",
    is_quote_status: true,
    quoted_status: { ...MOCK_PUBLIC_TESTIMONIALS[1], id_str: "9876543210" },
  };
  vi.mocked(getPublicTestimonials).mockResolvedValue([tweet]);
  const html = renderToStaticMarkup(await MarketingProof());
  expect(html).toContain("<article");
  expect(html).toContain(MOCK_PUBLIC_TESTIMONIALS[0].full_text!.slice(0, 24));
  expect(html).toContain(`https://x.com/mayachen/status/${tweet.id_str}`);
  // Presentation is intentionally minimal: the quoted post, post date, and
  // engagement metrics never render.
  expect(html).not.toContain(MOCK_PUBLIC_TESTIMONIALS[1].user!.name!);
  expect(html).not.toContain('dateTime="2024-03-27T10:00:00.000Z"');
  expect(html).not.toContain("Replying to");
});
test("incomplete posts do not produce broken profile or status links", async () => {
  vi.mocked(getPublicTestimonials).mockResolvedValue([
    { id_str: "123", full_text: "Hello", user: undefined },
    { ...MOCK_PUBLIC_TESTIMONIALS[0], id_str: "" },
  ]);
  expect(await MarketingProof()).toBeNull();
});

test("one available post stays static and has no duplicate or motion control", async () => {
  vi.mocked(getPublicTestimonials).mockResolvedValue([
    { ...MOCK_PUBLIC_TESTIMONIALS[0], id_str: "123" },
  ]);
  const html = renderToStaticMarkup(await MarketingProof());
  expect(html).toContain('data-single="true"');
  expect(html).not.toContain('inert=""');
  expect(html).not.toContain("Pause testimonials");
});
