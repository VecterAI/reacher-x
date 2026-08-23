import { describe, expect, it } from "vitest";
import {
  formatConversationDayLabel,
  formatConversationFileSize,
  getConversationMessageDisplayText,
  getConversationMessageGrouping,
  getFirstHttpUrl,
  getSharedXPostFromText,
  hasConversationMessageRichSurface,
  isSameXPostReference,
  shouldShowConversationDaySeparator,
} from "./conversationMessagePresentation";
import type { RichConversationMessage } from "../ui/components/conversation-message/types";

function message(
  id: string,
  createdAt: string,
  direction: "sent" | "received" = "received"
): RichConversationMessage {
  return {
    id,
    conversationId: "conversation-1",
    text: id,
    createdAt,
    direction,
  };
}

describe("conversation message presentation", () => {
  it("groups adjacent messages from the same direction inside five minutes", () => {
    const messages = [
      message("one", "2026-08-13T10:00:00.000Z"),
      message("two", "2026-08-13T10:02:00.000Z"),
      message("three", "2026-08-13T10:04:00.000Z"),
    ];

    expect(getConversationMessageGrouping(messages, 0)).toBe("first");
    expect(getConversationMessageGrouping(messages, 1)).toBe("middle");
    expect(getConversationMessageGrouping(messages, 2)).toBe("last");
  });

  it("breaks groups when direction changes or the time window expires", () => {
    const messages = [
      message("one", "2026-08-13T10:00:00.000Z"),
      message("two", "2026-08-13T10:01:00.000Z", "sent"),
      message("three", "2026-08-13T10:10:00.000Z", "sent"),
    ];

    expect(
      messages.map((_, index) =>
        getConversationMessageGrouping(messages, index)
      )
    ).toEqual(["none", "none", "none"]);
  });

  it("inserts separators only at the first message of each local day", () => {
    const messages = [
      message("one", "2026-08-12T10:00:00.000Z"),
      message("two", "2026-08-12T11:00:00.000Z"),
      message("three", "2026-08-13T10:00:00.000Z"),
    ];

    expect(
      messages.map((_, index) =>
        shouldShowConversationDaySeparator(messages, index)
      )
    ).toEqual([true, false, true]);
  });

  it("formats relative day labels and file sizes", () => {
    const now = new Date("2026-08-13T12:00:00.000Z").getTime();
    expect(formatConversationDayLabel("2026-08-13T10:00:00.000Z", now)).toBe(
      "Today"
    );
    expect(formatConversationFileSize(1_572_864)).toBe("1.5 MB");
  });

  it("extracts a link without sentence punctuation", () => {
    expect(getFirstHttpUrl("See https://example.com/docs). Thanks")).toBe(
      "https://example.com/docs"
    );
  });

  it("removes the duplicated post URL while preserving its caption", () => {
    expect(
      getConversationMessageDisplayText(
        "This was my post\n\nhttps://x.com/example/status/123",
        { hideFirstUrl: true }
      )
    ).toBe("This was my post");
    expect(
      getConversationMessageDisplayText("https://x.com/example/status/123", {
        hideFirstUrl: true,
      })
    ).toBe("");
  });

  it("recognizes canonical X and Twitter status URLs", () => {
    expect(
      getSharedXPostFromText(
        "See https://x.com/example/status/2087617456529633701?s=20"
      )
    ).toEqual({
      id: "2087617456529633701",
      url: "https://x.com/i/status/2087617456529633701",
    });
    expect(getSharedXPostFromText("See https://example.com/status/123")).toBe(
      undefined
    );
  });

  it("treats canonical and author X URLs as the same shared post", () => {
    const post = {
      id: "2087617456529633701",
      url: "https://x.com/i/status/2087617456529633701",
    };

    expect(
      isSameXPostReference(
        "https://x.com/ReacherXfounder/status/2087617456529633701?s=20",
        post
      )
    ).toBe(true);
    expect(
      isSameXPostReference(
        "https://twitter.com/ReacherXfounder/status/2087617456529633701",
        post
      )
    ).toBe(true);
    expect(
      isSameXPostReference("https://x.com/i/status/9999999999999999999", post)
    ).toBe(false);
  });

  it("uses content width for text and a bounded rich surface for attachments", () => {
    expect(
      hasConversationMessageRichSurface(
        { ...message("plain", "2026-08-13T10:00:00.000Z"), text: "Hello" },
        "linkedin"
      )
    ).toBe(false);
    expect(
      hasConversationMessageRichSurface(
        {
          ...message("media", "2026-08-13T10:00:00.000Z"),
          attachments: [{ type: "image", url: "https://example.com/a.jpg" }],
        },
        "twitter"
      )
    ).toBe(true);
    expect(
      hasConversationMessageRichSurface(
        {
          ...message("link", "2026-08-13T10:00:00.000Z"),
          text: "https://example.com",
        },
        "linkedin"
      )
    ).toBe(true);
  });
});
