// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useTwitterTimelineEngagementMerge } from "../useTwitterTimelineEngagementMerge";
import { useLinkedInPostEngagementMerge } from "../useLinkedInPostEngagementMerge";
import type { Tweet } from "@/features/threads/types";
import type { UnifiedPost } from "@/shared/lib/platforms/types";
const { query } = vi.hoisted(() => ({
  query: vi.fn((_reference: unknown, _args: unknown): unknown => undefined),
}));
vi.mock("convex/react", () => ({ useQuery: query }));
const tweet = {
  id_str: "fixture-post",
  user: { id_str: "fixture-user" },
  full_text: "Fixture",
} as Tweet;
const post = { id: "fixture-linkedin", platform: "linkedin" } as UnifiedPost;
function Probe({ enabled }: { enabled: boolean }) {
  const tweets = useTwitterTimelineEngagementMerge([tweet], enabled);
  const posts = useLinkedInPostEngagementMerge([post], enabled);
  return createElement("p", null, `${tweets[0].id_str}:${posts[0].id}`);
}
test("offline evidence skips all engagement queries and retains the supplied posts", () => {
  query.mockClear();
  expect(
    renderToStaticMarkup(createElement(Probe, { enabled: false }))
  ).toContain("fixture-post:fixture-linkedin");
  expect(query.mock.calls).toHaveLength(3);
  for (const call of query.mock.calls) expect(call[1]).toBe("skip");
});
test("live evidence retains its existing engagement queries", () => {
  query.mockClear();
  renderToStaticMarkup(createElement(Probe, { enabled: true }));
  expect(query.mock.calls[0][1]).toEqual({ postIds: ["fixture-post"] });
  expect(query.mock.calls[1][1]).toEqual({ targetUserIds: ["fixture-user"] });
});
