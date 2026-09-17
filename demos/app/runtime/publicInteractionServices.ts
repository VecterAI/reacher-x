import { api } from "@/convex/_generated/api";
import { getStringProperty } from "@/convex/lib/typeGuards";
import { normalizeLinkedInPost } from "@/shared/lib/linkedin/post";
import { buildLinkedInCommentPreview } from "@/shared/lib/linkedin/comments";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { isUseCaseWalkthrough } from "@/features/blog/lib/useCaseWalkthroughCopy";
import { PUBLIC_OUTREACH_DEMO_COPY } from "@/features/blog/lib/publicOutreachDemoCopy";
import type { createAppFixtures } from "./appFixtures";
import type { LocalClient } from "./LocalClient";
import { recordDemoComment } from "./lifecycleHelpers";

export function registerPublicInteractionServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>
) {
  const postFor = (id?: string) =>
    state.prospects
      .flatMap((person) => person.evidencePosts ?? [])
      .find((post) => getStringProperty(post, "postID") === id);
  if (
    !isUseCaseWalkthrough(state.scenario) &&
    !["getting-started-with-reacherx", "introducing-reacherx-v4"].includes(
      state.scenario
    )
  ) {
    for (const person of state.prospects.filter(
      (person) =>
        person.platform === "linkedin" &&
        person.qualificationStatus === "qualified"
    )) {
      const post = person.evidencePosts?.[0];
      const id = getStringProperty(post, "postID");
      if (post && id)
        recordDemoComment(
          state.lifecycle,
          person,
          post,
          id,
          PUBLIC_OUTREACH_DEMO_COPY[state.scenario]?.edited ??
            `Thanks for sharing this. Which part of ${person.matchedKeywords?.[0]?.toLowerCase() ?? "the project"} would you approach differently next time?`,
          `demo-earlier-comment-${person._id}`,
          person._creationTime + 30000
        );
    }
  }
  const commentsFor = (postId: string) =>
    state.lifecycle.interactions
      .filter(
        (entry) => entry.interactionType !== "dm" && entry.threadId === postId
      )
      .map((entry) => ({
        ...buildLinkedInCommentPreview({
          id: entry.replyPostId!,
          postId,
          text: entry.replyText ?? "",
          createdAt: new Date(entry.repliedAt).toISOString(),
          author: { name: "Maya Chen", headline: "Founder", isViewer: true },
        }),
        canReply: true,
      }));
  client.register(
    api.linkedin.getLinkedInPostThreadContext,
    ({ postId, postData, sort }) => {
      const post = normalizeLinkedInPost(postFor(postId) ?? postData);
      if (!post) throw new Error("Post not found");
      return {
        source: "preview" as const,
        resolvedPost: post,
        resolvedPostId: post.id,
        resolvedSocialId: post.id,
        permissions: { canComment: true, canReact: false, canShare: false },
        eligibility: {
          enabled: true,
          reasonCode: "eligible" as const,
          reasonLabel: "Connected",
        },
        topLevelComments: {
          items: commentsFor(post.id),
          cursor: null,
          totalItems: commentsFor(post.id).length,
          sort: sort ?? "MOST_RELEVANT",
          source: "preview" as const,
        },
      };
    }
  );
  client.register(
    api.linkedin.getLinkedInCommentReplies,
    ({ postId, sort }) => ({
      resolvedPostId: postId ?? "",
      page: {
        items: [],
        cursor: null,
        sort: sort ?? "MOST_RELEVANT",
        source: "preview" as const,
      },
    })
  );
  client.register(
    api.linkedin.sendLinkedInPostComment,
    async ({ prospectId, postId, text }) => {
      const person = state.prospects.find(
        (person) => person._id === prospectId
      );
      const post = postFor(postId);
      if (!person || !post || !person.evidencePosts?.includes(post))
        throw new Error("Post not found for this prospect");
      const account = await client.query(
        api.connectedAccounts.getConnectionSnapshot,
        { platform: "linkedin" }
      );
      if (!account.isConnected)
        throw new Error("Connect LinkedIn before commenting");
      if (!text.trim()) throw new Error("Write a comment first");
      const commentId = `demo-comment-${state.lifecycle.interactions.length + 1}`;
      const now = getCurrentUTCTimestamp();
      recordDemoComment(
        state.lifecycle,
        person,
        post,
        postId,
        text.trim(),
        commentId,
        now
      );
      return {
        success: true as const,
        commentId,
        resolvedPostId: postId,
        resolvedSocialId: postId,
        postedAt: new Date(now).toISOString(),
      };
    }
  );
}
