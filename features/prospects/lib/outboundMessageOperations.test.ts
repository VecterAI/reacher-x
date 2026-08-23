import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { mergeOutboundMessageOperations } from "./outboundMessageOperations";

const prospectId = "prospect-1" as Id<"prospects">;

describe("outbound message presentation", () => {
  test("adds ordered pending and failed messages without hiding canonical history", () => {
    const merged = mergeOutboundMessageOperations(
      [
        {
          id: "provider-existing",
          conversationId: "conversation-1",
          text: "Earlier",
          createdAt: new Date(1_000).toISOString(),
          direction: "received" as const,
        },
      ],
      [
        {
          clientRequestId: "request-1",
          prospectId,
          platform: "twitter",
          conversationId: "conversation-1",
          text: "Queued",
          status: "queued",
          attemptCount: 0,
          createdAt: 2_000,
          updatedAt: 2_000,
        },
        {
          clientRequestId: "request-2",
          prospectId,
          platform: "twitter",
          conversationId: "conversation-1",
          text: "Failed",
          status: "failed",
          attemptCount: 1,
          createdAt: 3_000,
          updatedAt: 3_000,
          errorMessage: "Provider unavailable",
        },
      ],
      "conversation-1"
    );

    expect(merged.map((message) => message.text)).toEqual([
      "Earlier",
      "Queued",
      "Failed",
    ]);
    expect(merged[1]).toMatchObject({
      deliveryStatus: "queued",
      outboundClientRequestId: "request-1",
    });
    expect(merged[2]).toMatchObject({
      deliveryStatus: "failed",
      deliveryError: "Provider unavailable",
    });
  });

  test("removes the local echo once the canonical provider message exists", () => {
    const merged = mergeOutboundMessageOperations(
      [
        {
          id: "canonical-row",
          providerMessageId: "provider-1",
          conversationId: "conversation-1",
          text: "Delivered",
          createdAt: new Date(2_000).toISOString(),
          direction: "sent" as const,
        },
      ],
      [
        {
          clientRequestId: "request-1",
          prospectId,
          platform: "linkedin",
          text: "Delivered",
          status: "sent",
          attemptCount: 1,
          createdAt: 1_900,
          updatedAt: 2_000,
          providerMessageId: "provider-1",
        },
      ],
      "conversation-1"
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("canonical-row");
  });

  test("preserves visual metadata before and after provider reconciliation", () => {
    const operation = {
      clientRequestId: "request-media",
      prospectId,
      platform: "twitter" as const,
      text: "",
      mediaUrls: ["https://storage.example/portrait.mp4"],
      mediaKinds: ["video" as const],
      mediaFileNames: ["portrait.mp4"],
      mediaMetadata: [
        {
          width: 1080,
          height: 1920,
          durationMs: 4_200,
          mimeType: "video/mp4",
          fileSize: 12_345,
        },
      ],
      status: "sending" as const,
      attemptCount: 1,
      createdAt: 2_000,
      updatedAt: 2_100,
    };

    const [pending] = mergeOutboundMessageOperations(
      [],
      [operation],
      "conversation-1"
    );
    expect(pending?.attachments?.[0]).toMatchObject({
      type: "video",
      width: 1080,
      height: 1920,
      durationMs: 4_200,
      mimeType: "video/mp4",
      fileSize: 12_345,
    });

    const [canonical] = mergeOutboundMessageOperations(
      [
        {
          id: "provider-media",
          providerMessageId: "provider-media",
          conversationId: "conversation-1",
          text: "",
          createdAt: new Date(2_100).toISOString(),
          direction: "sent" as const,
          attachments: [
            {
              type: "attachment",
              url: "https://provider.example/portrait.mp4",
            },
          ],
        },
      ],
      [{ ...operation, providerMessageId: "provider-media", status: "sent" }],
      "conversation-1"
    );
    expect(canonical?.attachments?.[0]).toMatchObject({
      type: "video",
      width: 1080,
      height: 1920,
      mimeType: "video/mp4",
    });
  });
});
