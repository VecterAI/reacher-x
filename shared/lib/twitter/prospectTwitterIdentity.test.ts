import { describe, expect, test } from "vitest";
import {
  buildTwitterReplyInteractionParticipants,
  resolveProspectTwitterIdentity,
} from "./prospectTwitterIdentity";

describe("buildTwitterReplyInteractionParticipants", () => {
  const prospect = {
    userId: "prospect-id",
    username: "prospect",
    displayName: "Prospect Person",
    avatarUrl: "https://example.com/prospect.jpg",
  };

  test("uses the prospect's own id when replying to the prospect", () => {
    expect(
      buildTwitterReplyInteractionParticipants({
        prospect,
        parentAuthorId: "prospect-id",
        parentAuthorHandle: "Prospect",
      })
    ).toEqual([
      {
        id: "prospect-id",
        handle: "prospect",
        name: "Prospect Person",
        avatarUrl: "https://example.com/prospect.jpg",
      },
      { name: "You", isViewer: true },
    ]);
  });

  test("keeps a different parent author as a separate participant", () => {
    expect(
      buildTwitterReplyInteractionParticipants({
        prospect,
        parentAuthorId: "third-party-id",
        parentAuthorHandle: "thirdparty",
      })
    ).toEqual([
      {
        id: "prospect-id",
        handle: "prospect",
        name: "Prospect Person",
        avatarUrl: "https://example.com/prospect.jpg",
      },
      {
        id: "third-party-id",
        handle: "thirdparty",
        name: "thirdparty",
      },
      { name: "You", isViewer: true },
    ]);
  });

  test("does not let a matching handle override conflicting user ids", () => {
    expect(
      buildTwitterReplyInteractionParticipants({
        prospect,
        parentAuthorId: "third-party-id",
        parentAuthorHandle: "prospect",
      })
    ).toHaveLength(3);
  });

  test("rejects unsafe numeric X ids before participant construction", () => {
    const identity = resolveProspectTwitterIdentity({
      displayName: "Unsafe Numeric ID",
      data: {
        user: {
          id: Number.MAX_SAFE_INTEGER + 1,
          screen_name: "unsafe-id",
        },
      },
    });

    expect(identity.userId).toBeUndefined();
    expect(
      buildTwitterReplyInteractionParticipants({
        prospect: identity,
        parentAuthorHandle: "unsafe-id",
      })[0]?.id
    ).toBeUndefined();
  });
});
