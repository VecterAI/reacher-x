import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
} from "./lib/functionBuilders";
import {
  ensureProspectThreadLink,
  getProspectThreadContextByThreadId,
  listProspectThreadIdsByProspect,
} from "./lib/relationshipHelpers";

export const getThreadProspectContext = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    const context = await getProspectThreadContextByThreadId(ctx.db, threadId);
    if (!context) {
      return null;
    }

    return {
      threadId,
      prospectId: context.link.prospectId,
      userId: context.link.userId,
      workspaceId: context.prospect.workspaceId,
      prospect: context.prospect,
    };
  },
});

export const listThreadIdsForProspect = internalQuery({
  args: {
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { prospectId }) => {
    return await listProspectThreadIdsByProspect(ctx.db, prospectId);
  },
});

export const ensureThreadLink = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    threadId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ensureProspectThreadLink(ctx, args);
  },
});

export const backfillLegacyProspectThreads = action({
  args: {},
  handler: async (ctx) => {
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

    let cursor: string | null = null;
    let scanned = 0;
    let created = 0;
    let existing = 0;
    let skipped = 0;
    let invalid = 0;
    let errors = 0;

    while (true) {
      const threadsPage: {
        page: Array<{
          _id: string;
          title?: string;
        }>;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
        userId: user._id,
        paginationOpts: { numItems: 100, cursor },
      });

      for (const thread of threadsPage.page) {
        scanned += 1;

        if (!thread.title?.startsWith("outreach:")) {
          skipped += 1;
          continue;
        }

        const prospectId = thread.title.slice(
          "outreach:".length
        ) as Id<"prospects">;
        if (!prospectId) {
          skipped += 1;
          continue;
        }

        try {
          const prospect = await ctx.runQuery(
            internal.prospects.getProspectInternal,
            { prospectId }
          );

          if (!prospect || prospect.userId !== user._id) {
            invalid += 1;
            continue;
          }

          const result = await ctx.runMutation(
            internal.prospectThreads.ensureThreadLink,
            {
              prospectId,
              threadId: thread._id,
              userId: user._id,
            }
          );

          if (result.created) {
            created += 1;
          } else {
            existing += 1;
          }
        } catch (error) {
          errors += 1;
          console.warn(
            `[ProspectThreads] Failed to backfill thread ${thread._id}`,
            error
          );
        }
      }

      if (threadsPage.isDone) {
        break;
      }

      cursor = threadsPage.continueCursor;
    }

    return {
      scanned,
      created,
      existing,
      skipped,
      invalid,
      errors,
    };
  },
});
