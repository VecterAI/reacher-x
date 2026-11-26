import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { listWorkspaceAgentMemoriesByCategory } from "./lib/agentMemoryCore";
import { internalQuery, mutation, query } from "./lib/functionBuilders";
import { isInlineAutocompleteEnabled } from "./lib/runtimeConfigHelpers";
import { getStyleMemoryCategory } from "./lib/styleSourceCore";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";

type ThreadHelperAiControlDoc = Doc<"threadHelperAiControls">;
type ViewerUser = Doc<"users">;
type StyleProfileCategory =
  | "writing_style_profile_twitter"
  | "writing_style_profile_linkedin";

const styleProfileCategoryValidator = v.union(
  v.literal("writing_style_profile_twitter"),
  v.literal("writing_style_profile_linkedin")
);

const autocompleteContextResultValidator = v.object({
  blockedByActiveStream: v.boolean(),
  workspace: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      useCaseKey: v.optional(v.string()),
    }),
    v.null()
  ),
  prospect: v.union(
    v.object({
      displayName: v.optional(v.string()),
      title: v.optional(v.string()),
      company: v.optional(v.string()),
      briefIntro: v.optional(v.string()),
      location: v.optional(v.string()),
      matchedKeywords: v.optional(v.array(v.string())),
    }),
    v.null()
  ),
  styleProfile: v.union(
    v.object({
      category: styleProfileCategoryValidator,
      narrative: v.string(),
    }),
    v.null()
  ),
});

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
 * Resolves all database context needed for an inline autocomplete request in a
 * single Convex query round-trip (auth user lookup, thread ownership + active
 * stream check, prospect, workspace, and social writing style profile).
 */
export const resolveAutocompleteContextInternal = internalQuery({
  args: {
    workosUserId: v.string(),
    workspaceId: v.optional(v.string()),
    prospectId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    platform: v.optional(
      v.union(v.literal("twitter"), v.literal("linkedin"), v.literal("generic"))
    ),
  },
  returns: autocompleteContextResultValidator,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_user_id", (q) =>
        q.eq("workosUserId", args.workosUserId)
      )
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const prospectDocId = args.prospectId
      ? ctx.db.normalizeId("prospects", args.prospectId)
      : null;

    const [threadCheck, prospectDoc] = await Promise.all([
      args.threadId
        ? Promise.all([
            ctx.runQuery(components.agent.threads.getThread, {
              threadId: args.threadId,
            }),
            ctx.runQuery(components.agent.streams.list, {
              threadId: args.threadId,
              statuses: ["streaming"],
            }),
          ])
        : Promise.resolve(null),
      prospectDocId ? ctx.db.get(prospectDocId) : Promise.resolve(null),
    ]);

    if (threadCheck) {
      const [thread, activeStreams] = threadCheck;
      if (!thread || thread.userId !== user._id) {
        throw new Error("Not authorized");
      }
      if (activeStreams.length > 0) {
        return {
          blockedByActiveStream: true,
          workspace: null,
          prospect: null,
          styleProfile: null,
        };
      }
    }

    const ownedProspect =
      prospectDoc && prospectDoc.userId === user._id ? prospectDoc : null;

    const candidateWorkspaceId =
      args.workspaceId ??
      (ownedProspect?.workspaceId
        ? String(ownedProspect.workspaceId)
        : undefined);
    const workspaceDocId = candidateWorkspaceId
      ? ctx.db.normalizeId("workspaces", candidateWorkspaceId)
      : null;

    let workspaceDoc = workspaceDocId ? await ctx.db.get(workspaceDocId) : null;
    if (workspaceDoc && workspaceDoc.userId !== user._id) {
      workspaceDoc = null;
    }

    if (!workspaceDoc) {
      workspaceDoc = await ctx.db
        .query("workspaces")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", user._id).eq("isDefault", true)
        )
        .first();
    }

    // Only apply social writing-style memory on Twitter/LinkedIn surfaces.
    // Agent chat ("generic") should stay direct instead of adopting tweet voice.
    let styleProfile: {
      category: StyleProfileCategory;
      narrative: string;
    } | null = null;

    if (
      workspaceDoc &&
      (args.platform === "twitter" || args.platform === "linkedin")
    ) {
      const category = getStyleMemoryCategory(
        args.platform
      ) as StyleProfileCategory;
      const [latestStyleMemory] = await listWorkspaceAgentMemoriesByCategory(
        ctx.db,
        {
          workspaceId: workspaceDoc._id,
          category,
          limit: 1,
        }
      );
      const narrative =
        latestStyleMemory?.parsed.narrative ||
        latestStyleMemory?.memoryText ||
        "";
      if (narrative) {
        styleProfile = { category, narrative };
      }
    }

    return {
      blockedByActiveStream: false,
      workspace: workspaceDoc
        ? {
            id: String(workspaceDoc._id),
            name: workspaceDoc.name,
            description: workspaceDoc.description ?? undefined,
            useCaseKey:
              typeof workspaceDoc.useCaseKey === "string"
                ? workspaceDoc.useCaseKey
                : undefined,
          }
        : null,
      prospect: ownedProspect
        ? {
            displayName: ownedProspect.displayName ?? undefined,
            title: ownedProspect.title ?? undefined,
            company: ownedProspect.company ?? undefined,
            briefIntro: ownedProspect.briefIntro ?? undefined,
            location: ownedProspect.location ?? undefined,
            matchedKeywords: ownedProspect.matchedKeywords ?? undefined,
          }
        : null,
      styleProfile,
    };
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
