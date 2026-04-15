import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import { SERVER_ACTIVITY_WRITE_DEBOUNCE_MS } from "../../shared/lib/workspaceSystem";

type WorkspaceActivityCtx = Pick<MutationCtx, "db">;

export async function recordWorkspaceActivityWithDb(
  ctx: WorkspaceActivityCtx,
  workspaceId: Id<"workspaces">,
  now = getCurrentUTCTimestamp()
) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    return { updated: false, now };
  }

  if (
    typeof workspace.lastMeaningfulActivityAt === "number" &&
    now - workspace.lastMeaningfulActivityAt < SERVER_ACTIVITY_WRITE_DEBOUNCE_MS
  ) {
    return { updated: false, now };
  }

  await ctx.db.patch(workspaceId, {
    lastMeaningfulActivityAt: now,
  });

  return { updated: true, now };
}
