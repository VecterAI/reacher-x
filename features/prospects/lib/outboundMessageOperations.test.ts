import { describe, expect, test, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  mergeOutboundMessageOperations,
  retryLocalOutboundMessageOperation,
} from "./outboundMessageOperations";

const prospectId = "prospect-1" as Id<"prospects">;

describe("outbound message presentation", () => {
  test("forwards approval ownership when retrying a failed local enqueue", async () => {
    const actionRequestId = "action-request-1" as Id<"agentActionRequests">;
    const enqueue = vi.fn().mockResolvedValue({ queued: true });

    await expect(
      retryLocalOutboundMessageOperation(
        {
          clientRequestId: "request-approval-retry",
          prospectId,
          platform: "linkedin",
          conversationId: "conversation-1",
          text: "Approved message",
          actionRequestId,
          status: "failed",
          attemptCount: 0,
          createdAt: 1_000,
          updatedAt: 1_001,
          errorMessage: "Initial enqueue failed",
        },
        enqueue
      )
    ).resolves.toEqual({ queued: true });
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ actionRequestId })
    );
  });

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
      deliveryError: "X/Twitter couldn't send this message. Try again.",
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

  test("does not reconcile a nonmatching authoritative provider ID", () => {
    const merged = mergeOutboundMessageOperations(
      [
        {
          id: "canonical-row",
          providerMessageId: "provider-other",
          conversationId: "conversation-1",
          text: "Same text",
          createdAt: new Date(2_000).toISOString(),
          direction: "sent" as const,
        },
      ],
      [
        {
          clientRequestId: "request-1",
          prospectId,
          platform: "linkedin",
          text: "Same text",
          status: "sent",
          attemptCount: 1,
          createdAt: 1_900,
          updatedAt: 2_000,
          providerMessageId: "provider-expected",
        },
      ],
      "conversation-1"
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((message) => message.id)).toContain("outbound:request-1");
  });

  test("uses the bounded heuristic only before a provider ID is known", () => {
    const merged = mergeOutboundMessageOperations(
      [
        {
          id: "canonical-row",
          conversationId: "conversation-1",
          text: "Delivered before the ID arrived",
          createdAt: new Date(2_000).toISOString(),
          direction: "sent" as const,
        },
      ],
      [
        {
          clientRequestId: "request-1",
          prospectId,
          platform: "linkedin",
          text: "Delivered before the ID arrived",
          status: "sending",
          attemptCount: 1,
          createdAt: 1_900,
          updatedAt: 2_000,
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
