// convex/integrations/linkedin/searchUserPostsQueue.ts
// Mutation entry point for starting LinkedIn user-post evidence searches from
// durable workflows.
//
// This file exists separately from searchUserPosts.ts because that file runs
// in the Node.js runtime ("use node") and Convex does not allow mutations in
// Node.js files. Workflow steps call `startUserPostsSearchForResult` to start
// the search via the action retrier, then wait on the persisted terminal
// result (see lib/retrierWorkflow.ts) instead of billing a live action while
// the search runs.

import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { internalMutation } from "../../lib/functionBuilders";
import { runProviderActionRetried } from "../../lib/retrier";

/**
 * Start a multi-keyword user-post search for a profile via the action
 * retrier. The terminal result is persisted by the retrier's `onComplete`
 * hook; poll it with `internal.lib.retrier.getRetriedActionResult`.
 *
 * The retrier runs the core exactly once (`maxFailures: 0`): the core
 * already tolerates per-keyword provider failures internally, and a
 * whole-core retry would re-run every keyword search — real provider spend
 * — just to reproduce results it already has.
 */
export const startUserPostsSearchForResult = internalMutation({
  args: {
    urn: v.string(),
    keywords: v.array(v.string()),
    maxPosts: v.optional(v.number()),
  },
  returns: v.object({ runId: v.string() }),
  handler: async (ctx, args): Promise<{ runId: string }> => {
    const runId = await runProviderActionRetried(
      ctx,
      internal.integrations.linkedin.searchUserPosts.searchUserPostsCore,
      {
        urn: args.urn,
        keywords: args.keywords,
        maxPosts: args.maxPosts,
      },
      {
        maxFailures: 0,
        onComplete: internal.lib.retrier.recordRetriedActionCompletion,
      }
    );
    return { runId };
  },
});
