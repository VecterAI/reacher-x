import { describe, expect, it } from "vitest";
import { getLockedXChatToolEvidence } from "../../../lib/xChatToolEvidence";

describe("getLockedXChatToolEvidence", () => {
  it("finds encrypted XChat evidence without confusing legacy DM data", () => {
    expect(
      getLockedXChatToolEvidence({
        success: true,
        history: {
          prospect: { name: "Nikolay" },
          evidence: [
            {
              platform: "twitter",
              legacyDm: { conversationFound: true },
              xChat: {
                conversationFound: true,
                contentState: "encrypted_locked",
                eventCount: 23,
                inboundEventCount: 8,
                outboundEventCount: 15,
                hasMore: true,
              },
            },
          ],
        },
      })
    ).toEqual({
      prospectName: "Nikolay",
      eventCount: 23,
      inboundEventCount: 8,
      outboundEventCount: 15,
      hasMore: true,
    });
  });

  it("does not offer unlock for unavailable XChat evidence", () => {
    expect(
      getLockedXChatToolEvidence({
        history: {
          evidence: [
            {
              platform: "twitter",
              xChat: {
                conversationFound: false,
                contentState: "unavailable",
              },
            },
          ],
        },
      })
    ).toBeNull();
  });
});
