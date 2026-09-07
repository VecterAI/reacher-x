import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export async function clearWorkspaceKeywords(
  ctx: ActionCtx,
  workspaceId: Doc<"workspaces">["_id"],
  expectedTargetingFingerprint?: string
) {
  let deleted = 0;
  let hasMore = true;

  while (hasMore) {
    const result: { deleted: number; hasMore: boolean } = await ctx.runMutation(
      internal.keywords.deleteWorkspaceKeywordsBatchInternal,
      { workspaceId, limit: 250, expectedTargetingFingerprint }
    );
    deleted += result.deleted;
    hasMore = result.hasMore;
  }

  return deleted;
}
