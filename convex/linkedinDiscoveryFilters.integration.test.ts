import { describe, expect, test, vi } from "vitest";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { searchLinkedInInternal } from "./workflows/prospecting";

type Args = FunctionArgs<
  typeof internal.workflows.prospecting.searchLinkedInInternal
>;
type Result = FunctionReturnType<
  typeof internal.workflows.prospecting.searchLinkedInInternal
>;
// Convex's registered _handler is used to spy on the real orchestration's
// provider boundary without performing external searches in regression tests.
const handler = (
  searchLinkedInInternal as unknown as {
    _handler: (ctx: ActionCtx, args: Args) => Promise<Result>;
  }
)._handler;

async function execute(applyProviderFilters?: boolean) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const ctx = {
    runQuery: vi.fn(async () => ({
      userId: "test-user",
      name: "QA",
      targetingSpec: {
        searchFilters: {
          linkedinPosts: {
            authorJobTitle: "Founder",
            datePosted: "past-month",
          },
          linkedinPeople: { location: "United States", profileLanguage: "en" },
        },
      },
    })),
    runAction: async (
      ref: Parameters<typeof getFunctionName>[0],
      args: Record<string, unknown>
    ): Promise<unknown> => {
      const name = getFunctionName(ref);
      if (name === "workflows/prospecting:searchLinkedInInternal")
        return await handler(ctx as unknown as ActionCtx, args as Args);
      calls.push({ name, args });
      const queries = args.queries as string[];
      return {
        success: true,
        posts: [],
        people: [],
        matchedQueriesByPostId: {},
        matchedQueriesByPersonUrn: {},
        errors: [],
        queryStats: queries.map((query) => ({
          query,
          success: true,
          postsFound: 0,
          peopleFound: 0,
        })),
      };
    },
  };
  const result = await handler(ctx as unknown as ActionCtx, {
    workspaceId: "workspace" as Id<"workspaces">,
    postQueries: ["strict post", "balanced post", "broad post"],
    peopleQueries: ["strict person", "broad person"],
    relaxedQueries: ["balanced post", "broad post", "broad person"],
    applyProviderFilters,
  });
  return { calls, result };
}
describe("LinkedIn discovery stages at the provider boundary", () => {
  test("strict searches receive supported filters; balanced and broad do not", async () => {
    const { calls, result } = await execute();
    expect(result.success).toBe(true);
    expect(result.postQueryStats).toHaveLength(3);
    expect(result.peopleQueryStats).toHaveLength(2);
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      const queries = call.args.queries as string[];
      const strict = queries[0].startsWith("strict");
      if (call.name.includes("searchPeople")) {
        expect(call.args.location).toBe(strict ? "United States" : undefined);
        expect(call.args.profileLanguage).toBe(strict ? "en" : undefined);
      } else {
        expect(call.args.authorJobTitle).toBe(strict ? "Founder" : undefined);
        expect(call.args.datePosted).toBe(strict ? "past-month" : undefined);
      }
    }
  });
  test("an explicit filters-off override is never re-enabled by stage splitting", async () => {
    const { calls, result } = await execute(false);
    expect(result.success).toBe(true);
    expect(calls).toHaveLength(2);
    for (const call of calls)
      for (const key of [
        "location",
        "profileLanguage",
        "authorJobTitle",
        "datePosted",
      ])
        expect(call.args[key]).toBeUndefined();
  });
});
