import type { Infer } from "convex/values";
import { outreachReactionTypeValidator } from "../validators";

export type OutreachReactionType = Infer<typeof outreachReactionTypeValidator>;
export type OutreachReactionPlatform = "twitter" | "linkedin";

export interface OutreachReactionTarget {
  platform: OutreachReactionPlatform;
  targetPostId: string;
  targetCommentId?: string;
  reactionType?: OutreachReactionType;
}

export interface OutreachReactionAdapters {
  likeXPost: (args: { postId: string }) => Promise<unknown>;
  reactToLinkedIn: (args: {
    postId: string;
    commentId?: string;
    reactionType: OutreachReactionType;
  }) => Promise<unknown>;
}

export interface ExecutedOutreachReaction {
  platform: OutreachReactionPlatform;
  provider: "x_twitter_sdk" | "linkedin_unipile";
  reactionType: OutreachReactionType;
  targetPostId: string;
  targetCommentId?: string;
}

export function normalizeOutreachReactionTarget(
  target: OutreachReactionTarget
): Required<
  Pick<OutreachReactionTarget, "platform" | "targetPostId" | "reactionType">
> &
  Pick<OutreachReactionTarget, "targetCommentId"> {
  const targetPostId = target.targetPostId.trim();
  const targetCommentId = target.targetCommentId?.trim() || undefined;
  const reactionType = target.reactionType ?? "like";

  if (!targetPostId) {
    throw new Error("Reaction tasks require a target post ID");
  }
  if (target.platform === "twitter" && reactionType !== "like") {
    throw new Error("X reaction tasks support only the like reaction");
  }
  if (target.platform === "twitter" && targetCommentId) {
    throw new Error("X replies are posts and must use targetPostId");
  }

  return {
    platform: target.platform,
    targetPostId,
    targetCommentId,
    reactionType,
  };
}

export async function executeOutreachReaction(
  target: OutreachReactionTarget,
  adapters: OutreachReactionAdapters
): Promise<ExecutedOutreachReaction> {
  const normalized = normalizeOutreachReactionTarget(target);

  if (normalized.platform === "twitter") {
    await adapters.likeXPost({ postId: normalized.targetPostId });
    return {
      platform: "twitter",
      provider: "x_twitter_sdk",
      reactionType: "like",
      targetPostId: normalized.targetPostId,
    };
  }

  await adapters.reactToLinkedIn({
    postId: normalized.targetPostId,
    commentId: normalized.targetCommentId,
    reactionType: normalized.reactionType,
  });
  return {
    platform: "linkedin",
    provider: "linkedin_unipile",
    reactionType: normalized.reactionType,
    targetPostId: normalized.targetPostId,
    targetCommentId: normalized.targetCommentId,
  };
}

export function isSameOutreachReactionTarget(
  left: OutreachReactionTarget,
  right: OutreachReactionTarget
): boolean {
  const normalizedLeft = normalizeOutreachReactionTarget(left);
  const normalizedRight = normalizeOutreachReactionTarget(right);
  return (
    normalizedLeft.platform === normalizedRight.platform &&
    normalizedLeft.targetPostId === normalizedRight.targetPostId &&
    normalizedLeft.targetCommentId === normalizedRight.targetCommentId &&
    normalizedLeft.reactionType === normalizedRight.reactionType
  );
}
