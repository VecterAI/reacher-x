import { describe, expect, test } from "vitest";
import {
  buildTwitterInteractionSearchQueries,
  getLinkedInCommentAuthorIdentifiers,
  getLinkedInPostIdentifiers,
  getStoredLinkedInInteractionCandidateMetadata,
  isReciprocalTwitterReply,
  normalizeLinkedInActorIdentifier,
} from "./prospectInteractionSyncCore";

describe("prospect interaction sync core", () => {
  test("builds reciprocal X reply searches scoped to both people", () => {
    expect(
      buildTwitterInteractionSearchQueries({
        viewerHandle: "owner",
        prospectHandle: "prospect",
        sinceTimeOperator: "since_time:1700000000",
      })
    ).toEqual({
      outgoing: "from:owner to:prospect filter:replies since_time:1700000000",
      incoming: "from:prospect to:owner filter:replies since_time:1700000000",
    });
  });

  test("matches LinkedIn actors across provider URNs and profile URLs", () => {
    expect(
      normalizeLinkedInActorIdentifier(
        "urn:li:fsd_profile:ACoAAExampleIdentifier"
      )
    ).toBe("acoaaexampleidentifier");
    expect(
      getLinkedInCommentAuthorIdentifiers({
        id: "comment-1",
        post_id: "post-1",
        author_details: {
          id: "ACoAAExampleIdentifier",
          profile_url: "https://www.linkedin.com/in/example-user/",
        },
      })
    ).toEqual(["acoaaexampleidentifier", "example-user"]);
  });

  test("indexes both Unipile post id forms used by comment payloads", () => {
    expect(
      getLinkedInPostIdentifiers({
        provider: "LINKEDIN",
        id: "encoded-post-id",
        social_id: "urn:li:activity:123",
      })
    ).toEqual(["encoded-post-id", "urn:li:activity:123"]);
  });

  test("keeps only reciprocal replies from an X user timeline", () => {
    const shared = {
      viewerHandle: "Owner",
      viewerUserId: "viewer-1",
      prospectHandle: "Prospect",
      prospectUserId: "prospect-1",
    };

    expect(
      isReciprocalTwitterReply({
        ...shared,
        tweet: {
          user: { id_str: "prospect-1", screen_name: "prospect" },
          in_reply_to_status_id_str: "parent-1",
          in_reply_to_user_id_str: "viewer-1",
          in_reply_to_screen_name: "OWNER",
        },
      })
    ).toBe(true);
    expect(
      isReciprocalTwitterReply({
        ...shared,
        tweet: {
          user: { id_str: "stranger-1", screen_name: "stranger" },
          in_reply_to_status_id_str: "parent-2",
          in_reply_to_user_id_str: "prospect-1",
          in_reply_to_screen_name: "prospect",
        },
      })
    ).toBe(false);
    expect(
      isReciprocalTwitterReply({
        ...shared,
        tweet: {
          user: { id_str: "prospect-1", screen_name: "prospect" },
          in_reply_to_user_id_str: null,
          in_reply_to_screen_name: null,
        },
      })
    ).toBe(false);
  });

  test("does not rebuild incoming LinkedIn replies as outgoing comments", () => {
    expect(
      getStoredLinkedInInteractionCandidateMetadata({
        interactionType: "comment_reply_posted",
        direction: "incoming",
      })
    ).toBeNull();
    expect(
      getStoredLinkedInInteractionCandidateMetadata({
        interactionType: "comment_reply_posted",
        direction: "outgoing",
      })
    ).toEqual({
      interactionType: "comment_reply_posted",
      direction: "outgoing",
    });
  });
});
