import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./lib/functionBuilders";
import { isInlineAutocompleteEnabled } from "./lib/runtimeConfigHelpers";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

type ThreadHelperAiControlDoc = Doc<"threadHelperAiControls">;
type ViewerUser = Doc<"users">;

async function getCurrentUser(ctx: any): Promise<ViewerUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.runQuery(internal.users.getUserByWorkosIdInternal, {
    workosUserId: identity.subject,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

async function getOwnedThread(ctx: any, userId: Id<"users">, threadId: string) {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  if (!thread || thread.userId !== userId) {
    throw new Error("Not authorized");
  }
  return thread;
}

async function getThreadHelperControl(
  ctx: any,
  threadId: string
): Promise<ThreadHelperAiControlDoc | null> {
  return await ctx.db
    .query("threadHelperAiControls")
    .withIndex("by_thread", (q: any) => q.eq("threadId", threadId))
    .first();
}

export const getThreadHelperCancellationVersionInternal = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, { threadId }) => {
    const control = await getThreadHelperControl(ctx, threadId);
    return control?.cancellationVersion ?? 0;
  },
});

/**
 * Public feature flag for client composers. Backed by Convex deployment env
 * `INLINE_AUTOCOMPLETE_ENABLED` (`1`/`0`, also accepts true/false/on/off).
 */
export const isEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return isInlineAutocompleteEnabled();
  },
});

export const cancelThreadHelperRequests = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    cancellationVersion: v.number(),
  }),
  handler: async (ctx, { threadId }) => {
    const user = await getCurrentUser(ctx);
    await getOwnedThread(ctx, user._id, threadId);

    const existing = await getThreadHelperControl(ctx, threadId);
    const cancellationVersion = (existing?.cancellationVersion ?? 0) + 1;
    const updatedAt = getCurrentUTCTimestamp();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cancellationVersion,
        updatedAt,
      });
    } else {
      await ctx.db.insert("threadHelperAiControls", {
        userId: user._id,
        threadId,
        cancellationVersion,
        updatedAt,
      });
    }

    return { cancellationVersion };
  },
});
