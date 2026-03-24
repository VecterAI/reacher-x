import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Counts prospects with qualificationStatus "qualified" whose qualification
 * timestamp falls in [startMs, endMs]. Uses qualifiedAt when set, else updatedAt.
 */
export async function countQualifiedProspectsInRange(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startMs: number,
  endMs: number
): Promise<number> {
  const prospects = await ctx.db
    .query("prospects")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  let n = 0;
  for (const p of prospects) {
    if (p.qualificationStatus !== "qualified") continue;
    const ts = p.qualifiedAt ?? p.updatedAt;
    if (ts >= startMs && ts <= endMs) n++;
  }
  return n;
}
