"use node";

import { generateText } from "ai";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createAIProvider, FAST_MODEL } from "../../../lib/ai";
import type { EffectivePostTextLimit } from "../../../../shared/lib/twitter/xPostTextLimit";
import { getPostTextLimitError } from "../../../../shared/lib/twitter/xPostTextLimit";

type CommentLikeTask = {
  type: string;
  content?: string;
};

const openRouter = createAIProvider();

function normalizeDraftText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripWrappingQuotes(text: string): string {
  return text.replace(/^["'`\s]+|["'`\s]+$/g, "").trim();
}

function buildLimitInstruction(limit: EffectivePostTextLimit): string {
  if (limit.mode === "short") {
    return `Fit within ${limit.maxWeighted} weighted X characters. Be safely under the limit, not right on the edge.`;
  }
  return `Fit within ${limit.maxChars} raw characters.`;
}

export async function getEffectivePostLimitForAgentUser(
  ctx: {
    runQuery: (
      ref: any,
      args: { userId: Id<"users"> }
    ) => Promise<EffectivePostTextLimit>;
  },
  userId: Id<"users">
): Promise<EffectivePostTextLimit> {
  return await ctx.runQuery(
    internal.xPostLimits.getEffectivePostLimitInternal,
    {
      userId,
    }
  );
}

export async function getStoredXSubscriptionTypeForAgentUser(
  ctx: {
    runQuery: (
      ref: any,
      args: { userId: Id<"users"> }
    ) => Promise<{ xSubscriptionType?: string } | null>;
  },
  userId: Id<"users">
): Promise<string | undefined> {
  const account = await ctx.runQuery(
    internal.xStore.getXAccountForUserInternal,
    {
      userId,
    }
  );
  return account?.xSubscriptionType;
}

export async function shortenDraftToEffectiveXLimit(args: {
  text: string;
  limit: EffectivePostTextLimit;
}): Promise<string | null> {
  let candidate = normalizeDraftText(args.text);
  if (!getPostTextLimitError(candidate, args.limit)) {
    return candidate;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await generateText({
      model: openRouter(FAST_MODEL),
      temperature: 0.2,
      prompt: `Rewrite this X reply so it keeps the same intent, tone, and concrete detail, but is shorter.

Rules:
- Output only the rewritten reply text.
- No quotes, no explanation, no markdown.
- Keep it natural and human.
- Preserve any direct question if present.
- ${buildLimitInstruction(args.limit)}

Original:
${candidate}`,
    });

    candidate = stripWrappingQuotes(normalizeDraftText(result.text));
    if (!getPostTextLimitError(candidate, args.limit)) {
      return candidate;
    }
  }

  return null;
}

export async function repairOverLimitCommentTasks<
  T extends CommentLikeTask,
>(args: {
  ctx: {
    runQuery: (
      ref: any,
      taskArgs: { userId: Id<"users"> }
    ) => Promise<EffectivePostTextLimit>;
  };
  userId: Id<"users">;
  tasks: T[];
}): Promise<{
  tasks: T[];
  repairedCount: number;
  limit: EffectivePostTextLimit;
}> {
  const limit = await getEffectivePostLimitForAgentUser(args.ctx, args.userId);
  let repairedCount = 0;

  const tasks = await Promise.all(
    args.tasks.map(async (task) => {
      if (task.type !== "comment" || !task.content?.trim()) {
        return task;
      }

      const normalizedContent = normalizeDraftText(task.content);
      const error = getPostTextLimitError(normalizedContent, limit);
      if (!error) {
        return normalizedContent === task.content
          ? task
          : { ...task, content: normalizedContent };
      }

      const shortened = await shortenDraftToEffectiveXLimit({
        text: normalizedContent,
        limit,
      });
      if (!shortened) {
        throw new Error(error);
      }

      repairedCount += 1;
      return { ...task, content: shortened };
    })
  );

  return { tasks, repairedCount, limit };
}
