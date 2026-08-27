import { describe, expect, it } from "vitest";
import type { ProspectInteraction } from "@/features/prospects/types";
import {
  buildTwitterInteractionThreadFallbackTweets,
  groupProspectInteractionsByThread,
} from "./prospectInteractionThreads";
import {
  dedupeAndSortConversationTweets,
  mergeConversationTweetWithFallback,
  mergeConversationTweetsPreservingOrder,
} from "./twitterConversation";

function interaction(
  overrides: Partial<ProspectInteraction> & Pick<ProspectInteraction, "id">
): ProspectInteraction {
  return {
    platform: "twitter",
    originalPost: null,
    participants: [],
    threadId: "thread-1",
    repliedAt: 1,
    origin: "unknown",
    discoveredVia: "live_reconcile",
    ...overrides,
  };
}

describe("groupProspectInteractionsByThread", () => {
  it("renders reciprocal replies as one canonical thread", () => {
    const threads = groupProspectInteractionsByThread(
      [
        interaction({
          id: "incoming",
          repliedAt: 3,
          direction: "incoming",
          sourcePostRef: { platform: "twitter", postId: "owner-reply" },
        }),
        interaction({
          id: "outgoing",
          repliedAt: 2,
          direction: "outgoing",
          sourcePostRef: { platform: "twitter", postId: "thread-1" },
        }),
      ],
      "twitter"
    );

    expect(threads).toHaveLength(1);
    expect(threads[0].interactions.map((item) => item.id)).toEqual([
      "outgoing",
      "incoming",
    ]);
    expect(threads[0].representative.id).toBe("outgoing");
  });

  it("normalizes equivalent LinkedIn post URNs", () => {
    const threads = groupProspectInteractionsByThread(
      [
        interaction({
          id: "first",
          platform: "linkedin",
          threadId: "urn:li:activity:123",
        }),
        interaction({
          id: "second",
          platform: "linkedin",
          threadId: "123",
        }),
      ],
      "linkedin"
    );

    expect(threads).toHaveLength(1);
    expect(threads[0].threadId).toBe("123");
  });
});

describe("buildTwitterInteractionThreadFallbackTweets", () => {
  it("preserves the entire stored thread once and in chronological order", () => {
    const [thread] = groupProspectInteractionsByThread(
      [
        interaction({
          id: "outgoing",
          repliedAt: 2,
          sourcePostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "root" },
            url: "https://x.com/prospect/status/root",
            textPreview: "Root",
            createdAt: 1,
          },
          replyPostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "owner" },
            url: "https://x.com/owner/status/owner",
            textPreview: "Owner reply",
            createdAt: 2,
          },
        }),
        interaction({
          id: "incoming",
          repliedAt: 3,
          sourcePostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "owner" },
            url: "https://x.com/owner/status/owner",
            textPreview: "Owner reply",
            createdAt: 2,
          },
          replyPostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "prospect" },
            url: "https://x.com/prospect/status/prospect",
            textPreview: "Prospect response",
            createdAt: 3,
          },
        }),
      ],
      "twitter"
    );

    expect(
      buildTwitterInteractionThreadFallbackTweets(thread).map(
        (tweet) => tweet.id_str
      )
    ).toEqual(["root", "owner", "prospect"]);
  });

  it("does not let a partial provider payload erase a durable reply", () => {
    const merged = mergeConversationTweetWithFallback(
      {
        id_str: "owner",
        full_text: "Owner reply",
        tweet_created_at: "2026-08-27T10:43:00.000Z",
      },
      {
        id_str: "owner",
        full_text: "",
        text: "",
      }
    );

    expect(merged?.full_text).toBe("Owner reply");
    expect(merged?.tweet_created_at).toBe("2026-08-27T10:43:00.000Z");
  });

  it("keeps rich reply snapshots when a later interaction only has a source ref", () => {
    const [thread] = groupProspectInteractionsByThread(
      [
        interaction({
          id: "outgoing",
          repliedAt: 2,
          originalPost: { id_str: "root" },
          replyPostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "owner" },
            url: "https://x.com/owner/status/owner",
            textPreview: "Owner reply",
            createdAt: 2,
            inReplyToPostId: "root",
          },
        }),
        interaction({
          id: "incoming",
          repliedAt: 3,
          originalPost: {
            id_str: "owner",
            in_reply_to_status_id_str: "root",
          },
          replyPostSummary: {
            platform: "twitter",
            ref: { platform: "twitter", postId: "prospect" },
            url: "https://x.com/prospect/status/prospect",
            textPreview: "Prospect response",
            createdAt: 3,
            inReplyToPostId: "owner",
          },
        }),
      ],
      "twitter"
    );

    const fallbackTweets = buildTwitterInteractionThreadFallbackTweets(thread);

    expect(fallbackTweets.map((tweet) => tweet.id_str)).toEqual([
      "root",
      "owner",
      "prospect",
    ]);
    expect(fallbackTweets[1].full_text).toBe("Owner reply");
    expect(fallbackTweets[1].tweet_created_at).toBe("1970-01-01T00:00:00.002Z");
  });

  it("enriches existing posts without changing their rendered order", () => {
    const stable = dedupeAndSortConversationTweets([
      { id_str: "root", full_text: "Root" },
      {
        id_str: "owner",
        full_text: "Owner reply",
        in_reply_to_status_id_str: "root",
      },
      {
        id_str: "prospect",
        full_text: "Prospect response",
        tweet_created_at: "2026-08-27T10:44:00.000Z",
        in_reply_to_status_id_str: "owner",
      },
    ]);

    const enriched = mergeConversationTweetsPreservingOrder(stable, [
      {
        id_str: "owner",
        full_text: "Owner reply",
        tweet_created_at: "2026-08-27T10:43:00.000Z",
        in_reply_to_status_id_str: "root",
      },
      {
        id_str: "root",
        full_text: "Root",
        tweet_created_at: "2026-08-27T10:42:00.000Z",
      },
    ]);

    expect(stable.map((tweet) => tweet.id_str)).toEqual([
      "root",
      "owner",
      "prospect",
    ]);
    expect(enriched.map((tweet) => tweet.id_str)).toEqual([
      "root",
      "owner",
      "prospect",
    ]);
    expect(enriched[1].tweet_created_at).toBe("2026-08-27T10:43:00.000Z");
  });

  it("keeps provider posts when there is no stable conversation yet", () => {
    const merged = mergeConversationTweetsPreservingOrder(
      [],
      [
        {
          id_str: "reply",
          full_text: "Newly hydrated reply",
          tweet_created_at: "2026-08-27T10:43:00.000Z",
          in_reply_to_status_id_str: "root",
        },
        {
          id_str: "root",
          full_text: "Newly hydrated root",
          tweet_created_at: "2026-08-27T10:42:00.000Z",
        },
      ]
    );

    expect(merged.map((tweet) => tweet.id_str)).toEqual(["root", "reply"]);
  });
});
