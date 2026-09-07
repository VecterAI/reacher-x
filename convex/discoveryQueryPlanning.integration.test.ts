/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { robustGenerateObject } from "./lib/ai";
import { buildLegacyWorkspaceTargetingSpec } from "./lib/targetingSpecCore";
vi.mock("./lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/ai")>()),
  robustGenerateObject: vi.fn(),
}));
const modules = import.meta.glob("./**/*.ts");
const item = (query: string) => ({
  query,
  sourceKeyword: query,
  stage: "balanced" as const,
  criterionIds: [],
  searchMode: "raw" as const,
});
function generation(
  twitter: string[],
  linkedin: string[],
  people: string[] = []
) {
  return {
    object: {
      twitterQueries: twitter.map(item),
      linkedinPostQueries: linkedin.map(item),
      linkedinPeopleQueries: people.map(item),
      reasoning: "Grounded retrieval plan",
    },
    model: "sol",
    usage: {},
  } as never;
}
const spec = buildLegacyWorkspaceTargetingSpec({
  description: "Find users of Screen Studio",
  profiles: [],
});
spec.searchHints.entities = ["Screen Studio"];
afterEach(() => vi.clearAllMocks());
test("Sol planning bounds every retained platform group to five queries", async () => {
  const terms = Array.from({ length: 8 }, (_, i) => `software demo ${i}`);
  vi.mocked(robustGenerateObject).mockResolvedValue(
    generation(terms, terms, terms)
  );
  const t = convexTest(schema, modules);
  const result = await t.action(
    internal.agents.internal.convertToSocialQueriesAction,
    { keywords: terms, platforms: ["twitter", "linkedin"] }
  );
  expect(
    result.queryMetadata?.filter((x) => x.platformTargets.includes("twitter"))
  ).toHaveLength(5);
  expect(result.queriesByPlatform?.linkedin.posts).toHaveLength(5);
  expect(result.queriesByPlatform?.linkedin.people).toHaveLength(5);
  expect(vi.mocked(robustGenerateObject).mock.calls[0][0].routing).toBe(
    "onboarding"
  );
});
test("discarded platform groups cannot satisfy named entity coverage", async () => {
  vi.mocked(robustGenerateObject)
    .mockResolvedValueOnce(generation(["software demos"], ["Screen Studio"]))
    .mockResolvedValueOnce(generation(["Screen Studio"], []));
  const t = convexTest(schema, modules);
  const result = await t.action(
    internal.agents.internal.convertToSocialQueriesAction,
    {
      keywords: ["software demos"],
      platforms: ["twitter"],
      targetingSpec: spec,
    }
  );
  expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  expect(result.queriesByPlatform?.twitter).toContain("Screen Studio");
  expect(result.queriesByPlatform?.linkedin.posts).toHaveLength(0);
});
test("failed bounded repair falls back with named context instead of silently losing it", async () => {
  vi.mocked(robustGenerateObject).mockResolvedValue(
    generation(["software demos"], [])
  );
  const t = convexTest(schema, modules);
  const result = await t.action(
    internal.agents.internal.convertToSocialQueriesAction,
    {
      keywords: ["software demos"],
      platforms: ["twitter"],
      targetingSpec: spec,
    }
  );
  expect(robustGenerateObject).toHaveBeenCalledTimes(2);
  expect(result.queriesByPlatform?.twitter).toContain("Screen Studio");
  expect(result.reasoning).toContain("fallback");
});
