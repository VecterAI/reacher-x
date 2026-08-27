import type { Tweet } from "@/features/threads/types";
import type {
  ProspectInteraction,
  ProspectInteractionParticipant,
} from "@/features/prospects/types";
import { dedupeAndSortConversationTweets } from "./twitterConversation";
import { normalizeLinkedInReadUrn } from "@/shared/lib/linkedin/comments";
import { getTwitterPostId } from "@/shared/lib/twitter/contracts";
import { toFallbackTweetFromSummary } from "@/shared/lib/twitter/ui";

export interface ProspectInteractionThread {
  id: string;
  platform: "twitter" | "linkedin";
  threadId: string;
  interactions: ProspectInteraction[];
  representative: ProspectInteraction;
  participants: ProspectInteractionParticipant[];
  latestInteractionAt: number;
}

function getCanonicalThreadId(
  interaction: ProspectInteraction,
  platform: "twitter" | "linkedin"
): string {
  const rawThreadId =
    interaction.threadId?.trim() ||
    interaction.sourcePostRef?.conversationId?.trim() ||
    interaction.sourcePostRef?.postId?.trim() ||
    getTwitterPostId(interaction.originalPost)?.trim() ||
    interaction.id;

  return platform === "linkedin"
    ? (normalizeLinkedInReadUrn(rawThreadId) ?? rawThreadId)
    : rawThreadId;
}

function sourceMatchesThread(
  interaction: ProspectInteraction,
  platform: "twitter" | "linkedin",
  canonicalThreadId: string
): boolean {
  if (platform === "linkedin") {
    return normalizeLinkedInReadUrn(interaction.threadId) === canonicalThreadId;
  }

  return (
    interaction.sourcePostRef?.postId === canonicalThreadId ||
    getTwitterPostId(interaction.originalPost) === canonicalThreadId
  );
}

function mergeParticipants(
  interactions: ProspectInteraction[]
): ProspectInteractionParticipant[] {
  const byIdentity = new Map<string, ProspectInteractionParticipant>();

  for (const interaction of interactions) {
    for (const participant of interaction.participants) {
      const identity =
        participant.username.trim().toLowerCase() ||
        participant.name.trim().toLowerCase();
      if (identity && !byIdentity.has(identity)) {
        byIdentity.set(identity, participant);
      }
    }
  }

  return Array.from(byIdentity.values());
}

export function groupProspectInteractionsByThread(
  interactions: ProspectInteraction[],
  fallbackPlatform: "twitter" | "linkedin"
): ProspectInteractionThread[] {
  const groups = new Map<
    string,
    {
      platform: "twitter" | "linkedin";
      threadId: string;
      interactions: ProspectInteraction[];
    }
  >();

  for (const interaction of interactions) {
    const platform = interaction.platform ?? fallbackPlatform;
    const threadId = getCanonicalThreadId(interaction, platform);
    const id = `${platform}:${threadId}`;
    const existing = groups.get(id);

    if (existing) {
      existing.interactions.push(interaction);
    } else {
      groups.set(id, { platform, threadId, interactions: [interaction] });
    }
  }

  return Array.from(groups.entries())
    .map(([id, group]) => {
      const orderedInteractions = [...group.interactions].sort(
        (left, right) => left.repliedAt - right.repliedAt
      );
      const representative =
        orderedInteractions.find((interaction) =>
          sourceMatchesThread(interaction, group.platform, group.threadId)
        ) ?? orderedInteractions[0];

      return {
        id,
        platform: group.platform,
        threadId: group.threadId,
        interactions: orderedInteractions,
        representative,
        participants: mergeParticipants(orderedInteractions),
        latestInteractionAt: Math.max(
          ...orderedInteractions.map((interaction) => interaction.repliedAt)
        ),
      };
    })
    .sort(
      (left, right) => right.latestInteractionAt - left.latestInteractionAt
    );
}

export function buildTwitterInteractionThreadFallbackTweets(
  thread: ProspectInteractionThread
): Tweet[] {
  return dedupeAndSortConversationTweets(
    thread.interactions.flatMap((interaction) => [
      interaction.originalPost,
      interaction.sourcePostSummary
        ? toFallbackTweetFromSummary(interaction.sourcePostSummary)
        : null,
      interaction.replyPostSummary
        ? toFallbackTweetFromSummary(interaction.replyPostSummary)
        : null,
    ])
  );
}

export function getLinkedInThreadCommentIds(
  thread: ProspectInteractionThread
): string[] {
  return Array.from(
    new Set(
      thread.interactions
        .filter((interaction) => interaction.direction === "outgoing")
        .map(
          (interaction) =>
            interaction.replyPostId ??
            interaction.replyPostRef?.postId ??
            interaction.replyPostSummary?.ref.postId
        )
        .filter((commentId): commentId is string => Boolean(commentId))
    )
  );
}
