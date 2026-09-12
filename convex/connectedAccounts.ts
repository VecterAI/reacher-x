import type { Infer } from "convex/values";
import { query } from "./lib/functionBuilders";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/accessHelpers";
import {
  accountConnectionSnapshotValidator,
  prospectPlatformValidator,
} from "./validators";
import { toStoredXConnectionStatus } from "./lib/xConnectionStateCore";
import { toConnectionStatus } from "./lib/linkedinConnectionStateCore";

export const getConnectionSnapshot = query({
  args: { platform: prospectPlatformValidator },
  returns: accountConnectionSnapshotValidator,
  handler: async (
    ctx,
    { platform }
  ): Promise<Infer<typeof accountConnectionSnapshotValidator>> => {
    const user = await requireUser(ctx);
    const linkedin =
      platform === "linkedin"
        ? await ctx.db
            .query("linkedinAccounts")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first()
        : null;
    const twitter =
      platform === "twitter"
        ? await ctx.db
            .query("xAccounts")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first()
        : null;
    const stored =
      platform === "linkedin"
        ? toConnectionStatus(linkedin)
        : toStoredXConnectionStatus(twitter);
    const account = linkedin ?? twitter;
    const issue = stored.isConnected
      ? await ctx.runQuery(
          internal.workspaceStyleProfiles.getLatestUserStyleSyncIssue,
          {
            userId: user._id,
            platform,
            sourceVersion: account?.styleSourceVersion,
            sourceExternalUserId:
              linkedin?.providerId ?? linkedin?.accountId ?? twitter?.xUserId,
          }
        )
      : null;
    const snapshot = {
      isConnected: stored.isConnected,
      connectedAccountId: twitter ? String(twitter._id) : undefined,
      accountId: linkedin?.accountId,
      screenName: twitter?.username,
      name: twitter?.displayName,
      displayName: linkedin?.displayName,
      publicIdentifier: linkedin?.publicIdentifier,
      profileImageUrl: account?.profileImageUrl,
      connectedAt: account?._creationTime,
      missingScopes: twitter
        ? toStoredXConnectionStatus(twitter).missingScopes
        : undefined,
      styleSyncIssue: issue
        ? { key: issue.key, lastError: issue.lastError }
        : undefined,
    };
    return platform === "linkedin"
      ? { ...snapshot, platform, status: toConnectionStatus(linkedin).status }
      : {
          ...snapshot,
          platform,
          status: toStoredXConnectionStatus(twitter).status,
        };
  },
});
