import { describe, expect, test } from "vitest";
import { Client } from "@xdevplatform/xdk";
import {
  findDirectXChatConversation,
  normalizeXChatConversationPage,
  normalizeXChatEventPage,
  summarizeXChatEventPage,
} from "./xChatConversationHistoryCore";
import { getXChatConversationHistoryEvidence } from "./xdkTwitterProvider";

const viewerUserId = "1743216568451125248";
const participantUserId = "2035575047868583936";

describe("XChat conversation-history metadata", () => {
  test("selects only the direct conversation for the viewer and prospect", () => {
    const page = normalizeXChatConversationPage({
      data: [
        {
          id: "group-conversation",
          participant_ids: [viewerUserId, participantUserId, "third-user"],
          type: "group",
        },
        {
          id: "direct-conversation",
          participant_ids: [viewerUserId, participantUserId],
          type: "direct",
        },
      ],
      meta: { next_token: "next-page" },
    });

    expect(page.nextCursor).toBe("next-page");
    expect(
      findDirectXChatConversation({
        conversations: page.conversations,
        viewerUserId,
        participantUserId,
      })
    ).toMatchObject({ id: "direct-conversation" });
  });

  test("counts 23 ciphertext envelopes and eight inbound events without exposing ciphertext", () => {
    const data = Array.from({ length: 23 }, (_, index) => ({
      encoded_event: `ciphertext-${index}`,
      sender_id: index < 8 ? participantUserId : viewerUserId,
      created_at_msec: String(1_700_000_000_000 + index),
    }));
    const page = normalizeXChatEventPage({
      data,
      meta: { next_token: "older-encrypted-events" },
      hasMore: true,
    });
    const summary = summarizeXChatEventPage({
      page,
      viewerUserId,
      participantUserId,
    });

    expect(summary).toMatchObject({
      eventCount: 23,
      inboundEventCount: 8,
      outboundEventCount: 15,
      unattributedEventCount: 0,
      latestEventAt: 1_700_000_000_022,
      oldestEventAt: 1_700_000_000_000,
      nextCursor: "older-encrypted-events",
    });
    expect(page.events[0]).not.toHaveProperty("encodedEvent");
    expect(page.hasMore).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("ciphertext-");
  });

  test("uses timestamps only to bound a since read and keeps newer envelope counts", () => {
    const page = normalizeXChatEventPage({
      data: [
        {
          encoded_event: "newer-ciphertext",
          sender_id: participantUserId,
          created_at_msec: "2000",
        },
        {
          encoded_event: "older-ciphertext",
          sender_id: viewerUserId,
          created_at_msec: "1000",
        },
      ],
    });
    const summary = summarizeXChatEventPage({
      page,
      viewerUserId,
      participantUserId,
      sinceMs: 1_500,
    });

    expect(summary).toMatchObject({
      eventCount: 1,
      inboundEventCount: 1,
      outboundEventCount: 0,
      reachedSince: true,
      latestEventAt: 2000,
      oldestEventAt: 2000,
    });
  });

  test("uses the bare participant-events request and preserves partial encrypted coverage", async () => {
    const data = Array.from({ length: 23 }, (_, index) => ({
      encoded_event: `ciphertext-${index}`,
      sender_id: index < 8 ? participantUserId : viewerUserId,
      created_at_msec: String(1_700_000_000_000 + index),
    }));
    const boundedAccountWideListing = {
      data: [],
      meta: { next_token: "unread-account-wide-page" },
    };
    const requests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      const payload = url.includes("/events")
        ? { data, has_more: true }
        : boundedAccountWideListing;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;

    try {
      const evidence = await getXChatConversationHistoryEvidence(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId,
        { limit: 25 }
      );

      expect(requests).toHaveLength(1);
      expect(new URL(requests[0]!).pathname).toBe(
        `/2/chat/conversations/${participantUserId}/events`
      );
      expect(new URL(requests[0]!).search).toBe("");
      expect(evidence).toMatchObject({
        conversationFound: true,
        conversationLookupComplete: true,
        encrypted: true,
        contentState: "encrypted_locked",
        eventCount: 23,
        inboundEventCount: 8,
        outboundEventCount: 15,
        hasMore: true,
        pageLimitReached: true,
        boundary: "page_limit",
      });
      expect(JSON.stringify(evidence)).not.toContain("ciphertext-");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("marks the conversation found before a since filter excludes its encrypted event", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              encoded_event: "older-ciphertext",
              sender_id: participantUserId,
              created_at_msec: "1000",
            },
          ],
        }),
        { status: 200 }
      )) as typeof fetch;

    try {
      const evidence = await getXChatConversationHistoryEvidence(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId,
        { sinceMs: 2_000 }
      );

      expect(evidence).toMatchObject({
        conversationFound: true,
        eventCount: 0,
        inboundEventCount: 0,
        outboundEventCount: 0,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not report a conversation for an empty participant-events response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
      })) as typeof fetch;

    try {
      const evidence = await getXChatConversationHistoryEvidence(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId
      );

      expect(evidence).toMatchObject({
        conversationFound: false,
        conversationLookupComplete: true,
        conversationPagesFetched: 0,
        eventPagesFetched: 1,
        eventCount: 0,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
