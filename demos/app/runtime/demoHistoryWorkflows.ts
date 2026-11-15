import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Tweet } from "@/features/threads/types";
import type {
  TwitterPostRef,
  TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";
import type { LocalClient } from "./LocalClient";

export interface DemoHistoryActionRequest {
  actionRequestId: string;
  status: "pending_approval" | "completed" | "cancelled";
  title: string;
  description?: string;
  actionKey: string;
  platform: "twitter" | "linkedin";
  content: string;
  sourcePostData?: unknown;
  sourcePostRef?: TwitterPostRef;
  sourcePostSummary?: TwitterPostSummary;
  sourcePostId?: string;
  sourceContext?: string;
  mediaUrls?: string[];
  mediaKinds?: Array<"video" | "image" | "gif" | "file">;
  mediaDescriptions?: string[];
}

export interface DemoHistoryProfileProposal {
  requestId: string;
  status: "pending_approval" | "applied" | "rejected";
  revision: number;
  profileLabelPlural: string;
  proposedProfiles: Array<{
    title: string;
    description: string;
    painPoints: string[];
    channels: string[];
  }>;
  addedTitles: string[];
  updatedTitles: string[];
  removedTitles: string[];
  workspaceName: string;
}

/**
 * Seeded action requests and workspace-profile proposals that start in a
 * waiting state. The demo mutations below resolve them so inline approve and
 * reject controls behave like the real product instead of erroring.
 */
export const historyActionRequests = new Map<
  string,
  DemoHistoryActionRequest
>();
export const historyProfileProposals = new Map<
  string,
  DemoHistoryProfileProposal
>();

/** Fixture tweets backing the reply-approval thread preview. */
export const historyTwitterPosts = new Map<string, Tweet>();

/** Register a raw evidence post so reply panels can hydrate it as a tweet. */
export function registerDemoTwitterPost(raw: unknown): Tweet | null {
  const post = raw as {
    id_str?: unknown;
    full_text?: unknown;
    tweet_created_at?: unknown;
    user?: {
      name?: unknown;
      screen_name?: unknown;
      profile_image_url_https?: unknown;
    };
    favorite_count?: unknown;
    retweet_count?: unknown;
    reply_count?: unknown;
  };
  const id = typeof post?.id_str === "string" ? post.id_str : null;
  if (!id) return null;
  const name =
    typeof post.user?.name === "string" ? post.user.name : "Demo user";
  const screenName =
    typeof post.user?.screen_name === "string"
      ? post.user.screen_name
      : "demo_user";
  const numberish = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const tweet: Tweet = {
    tweet_created_at:
      typeof post.tweet_created_at === "string"
        ? post.tweet_created_at
        : undefined,
    id_str: id,
    conversation_id_str: id,
    full_text: typeof post.full_text === "string" ? post.full_text : undefined,
    user: {
      id: 0,
      id_str: `demo_user_${screenName}`,
      name,
      screen_name: screenName,
      protected: false,
      verified: false,
      followers_count: 0,
      friends_count: 0,
      listed_count: 0,
      favourites_count: 0,
      statuses_count: 0,
      created_at: new Date(0).toISOString(),
      profile_image_url_https:
        typeof post.user?.profile_image_url_https === "string"
          ? post.user.profile_image_url_https
          : "",
      can_dm: true,
    },
    favorite_count: numberish(post.favorite_count),
    retweet_count: numberish(post.retweet_count),
    reply_count: numberish(post.reply_count),
    lang: "en",
  };
  historyTwitterPosts.set(id, tweet);
  return tweet;
}

export function registerHistoryWorkflowServices(client: LocalClient) {
  client.register(api.socialActions.getActionRequestPanelContext, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) return null;
    return {
      mode:
        request.status === "completed"
          ? ("posted" as const)
          : ("approval" as const),
      platform: request.platform,
      actionRequestId: request.actionRequestId as Id<"agentActionRequests">,
      title: request.title,
      description: request.description,
      actionKey: request.actionKey,
      content: request.content,
      sourcePostRef: request.sourcePostRef,
      sourcePostSummary: request.sourcePostSummary,
      sourcePostData: request.sourcePostData,
      sourcePostId: request.sourcePostId,
      sourceContext: request.sourceContext,
      mediaUrls: request.mediaUrls ?? [],
      mediaDescriptions: request.mediaDescriptions ?? [],
      mediaKinds: request.mediaKinds ?? [],
      createdTweetId: undefined,
      status: request.status,
    };
  });
  client.register(api.socialActions.getActionRequestDraft, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) return null;
    return {
      actionRequestId: request.actionRequestId as Id<"agentActionRequests">,
      actionKey: request.actionKey,
      status: request.status,
      draftText: request.content,
      mediaUrls: request.mediaUrls ?? [],
      mediaDescriptions: request.mediaDescriptions ?? [],
      mediaKinds: (request.mediaKinds ?? []) as Array<
        "image" | "video" | "gif"
      >,
    };
  });
  client.register(api.socialActions.updatePendingActionRequestDraft, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) throw new Error("Social action request not found");
    if (request.status !== "pending_approval")
      throw new Error("Social action request is no longer pending approval");
    request.content = args.content;
    if (args.mediaUrls) request.mediaUrls = args.mediaUrls;
    if (args.mediaDescriptions)
      request.mediaDescriptions = args.mediaDescriptions;
    if (args.mediaKinds) request.mediaKinds = args.mediaKinds;
    client.notify();
    return { success: true };
  });
  client.register(api.socialActions.approveActionRequest, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) throw new Error("Social action request not found");
    if (request.status !== "pending_approval")
      return { success: true, duplicate: true };
    request.status = "completed";
    client.notify();
    return { success: true, duplicate: false };
  });
  client.register(api.socialActions.approveActionRequestWithEdits, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) throw new Error("Social action request not found");
    if (request.status !== "pending_approval")
      return { success: true, duplicate: true };
    request.content = args.content;
    request.status = "completed";
    client.notify();
    return { success: true, duplicate: false };
  });
  client.register(api.socialActions.cancelActionRequest, (args) => {
    const request = historyActionRequests.get(args.actionRequestId);
    if (!request) throw new Error("Social action request not found");
    if (request.status === "pending_approval") {
      request.status = "cancelled";
      client.notify();
    }
    return { success: true, duplicate: request.status !== "cancelled" };
  });
  client.register(api.socialapi.getTwitterPostsByIdsFromSocialApi, (args) => {
    const tweets = args.tweetIds
      .map((tweetId) => historyTwitterPosts.get(tweetId))
      .filter((tweet): tweet is Tweet => Boolean(tweet?.id_str));
    const resultsById = Object.fromEntries(
      args.tweetIds.map((tweetId) => [
        tweetId,
        historyTwitterPosts.has(tweetId)
          ? { status: "ok" as const, provider: "socialapi" as const }
          : {
              status: "not_found" as const,
              provider: "socialapi" as const,
              message: "This post is no longer available.",
            },
      ])
    );
    return {
      tweets,
      fetchedAt: Date.now(),
      resultsById,
    };
  });
  client.register(api.socialapi.getConversationContext, (args) => {
    const root = historyTwitterPosts.get(args.rootTweetId);
    return {
      rootTweetId: args.rootTweetId,
      hasMoreReplies: false,
      tweets: root ? [root] : [],
    };
  });
  client.register(
    api.workspaceProfileChanges.getWorkspaceProfileChange,
    (args) => {
      const proposal = historyProfileProposals.get(args.requestId);
      if (!proposal) return null;
      return {
        requestId: proposal.requestId as Id<"workspaceProfileChangeRequests">,
        status: proposal.status,
        revision: proposal.revision,
        profileLabelPlural: proposal.profileLabelPlural,
        proposedProfiles: proposal.proposedProfiles,
        addedTitles: proposal.addedTitles,
        updatedTitles: proposal.updatedTitles,
        removedTitles: proposal.removedTitles,
        workspaceName: proposal.workspaceName,
        removedProfiles: [],
      };
    }
  );
  client.register(
    api.workspaceProfileChanges.approveWorkspaceProfileChange,
    (args) => {
      const proposal = historyProfileProposals.get(args.requestId);
      if (!proposal) throw new Error("Workspace profile proposal not found.");
      if (proposal.revision !== args.expectedRevision)
        return { outcome: "superseded" as const, requestId: args.requestId };
      if (proposal.status !== "pending_approval")
        return { outcome: "stale" as const, requestId: args.requestId };
      proposal.status = "applied";
      client.notify();
      return { outcome: "applied" as const, requestId: args.requestId };
    }
  );
  client.register(
    api.workspaceProfileChanges.rejectWorkspaceProfileChange,
    (args) => {
      const proposal = historyProfileProposals.get(args.requestId);
      if (!proposal) throw new Error("Workspace profile proposal not found.");
      if (proposal.status === "pending_approval") {
        proposal.status = "rejected";
        client.notify();
      }
      return {
        outcome:
          proposal.status === "rejected"
            ? ("rejected" as const)
            : ("stale" as const),
        requestId: args.requestId,
      };
    }
  );
}
