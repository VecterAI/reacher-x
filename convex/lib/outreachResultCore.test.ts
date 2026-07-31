import { describe, expect, it } from "vitest";
import {
  getPostedOutreachArtifactId,
  hasRequiredPostedOutreachArtifact,
} from "./outreachResultCore";

describe("outreach result artifacts", () => {
  it("accepts a LinkedIn comment ID as posting evidence", () => {
    const task = {
      type: "comment" as const,
      approvalContext: { platform: "linkedin" as const },
    };

    expect(
      getPostedOutreachArtifactId(task, { commentId: "linkedin-comment-1" })
    ).toBe("linkedin-comment-1");
    expect(
      hasRequiredPostedOutreachArtifact(task, {
        messageId: "legacy-linkedin-comment-1",
      })
    ).toBe(true);
  });

  it("still requires a posted tweet ID for X comments", () => {
    const task = {
      type: "comment" as const,
      approvalContext: { platform: "twitter" as const },
    };

    expect(
      hasRequiredPostedOutreachArtifact(task, {
        commentId: "wrong-provider-artifact",
      })
    ).toBe(false);
    expect(
      getPostedOutreachArtifactId(task, { postedTweetId: "tweet-1" })
    ).toBe("tweet-1");
  });

  it("accepts either a message or conversation ID for DMs", () => {
    const task = {
      type: "dm" as const,
      approvalContext: { platform: "linkedin" as const },
    };

    expect(
      hasRequiredPostedOutreachArtifact(task, { messageId: "message-1" })
    ).toBe(true);
    expect(
      hasRequiredPostedOutreachArtifact(task, {
        conversationId: "conversation-1",
      })
    ).toBe(true);
    expect(hasRequiredPostedOutreachArtifact(task, {})).toBe(false);
  });

  it("requires the persisted reaction target for reaction tasks", () => {
    const task = {
      type: "react" as const,
      approvalContext: { platform: "linkedin" as const },
    };

    expect(
      getPostedOutreachArtifactId(task, {
        reactionTargetId: "linkedin-comment-1",
      })
    ).toBe("linkedin-comment-1");
    expect(hasRequiredPostedOutreachArtifact(task, {})).toBe(false);
  });
});
