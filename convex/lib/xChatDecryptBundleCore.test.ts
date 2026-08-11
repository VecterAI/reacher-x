import { Client } from "@xdevplatform/xdk";
import { describe, expect, it } from "vitest";
import {
  buildSanitizedXChatJuiceboxConfig,
  getXChatRealmAuthToken,
  normalizeXChatEncryptedEventPage,
  normalizeXChatPublicKeyRecords,
} from "./xChatDecryptBundleCore";
import { getXChatBrowserDecryptBundle } from "./xdkTwitterProvider";

const PUBLIC_KEYS_PAYLOAD = {
  data: [
    {
      public_key_version: "42",
      public_key: "identity-key",
      signing_public_key: "signing-key",
      identity_public_key_signature: "binding-signature",
      juicebox_config: {
        key_store_token_map_json: '{"realms":[]}',
        max_guess_count: 7,
        token_map: [
          {
            key: "AABB",
            value: { address: "https://realm.example", token: "realm-token" },
          },
        ],
      },
    },
  ],
};

const viewerUserId = "1743216568451125248";
const participantUserId = "2035575047868583936";

describe("XChat decrypt bundle normalization", () => {
  it("keeps signing material but strips realm tokens from browser config", () => {
    const [record] = normalizeXChatPublicKeyRecords(
      PUBLIC_KEYS_PAYLOAD,
      "user-1"
    );
    expect(record).toMatchObject({
      userId: "user-1",
      publicKeyVersion: "42",
      publicKey: "signing-key",
      identityPublicKey: "identity-key",
    });
    expect(buildSanitizedXChatJuiceboxConfig(record!)).toBe(
      '{"key_store_token_map_json":"{\\"realms\\":[]}","max_guess_count":7}'
    );
    expect(buildSanitizedXChatJuiceboxConfig(record!)).not.toContain(
      "realm-token"
    );
    expect(getXChatRealmAuthToken(record!, "aabb")).toBe("realm-token");
  });

  it("preserves only encrypted event envelopes", () => {
    expect(
      normalizeXChatEncryptedEventPage({
        data: [
          {
            id: "event-1",
            conversation_id: "1-2",
            sender_id: "user-2",
            created_at_msec: "123",
            encoded_event: "ciphertext",
          },
          { id: "missing-ciphertext" },
        ],
        meta: { next_token: "next" },
        has_more: true,
      })
    ).toEqual({
      events: [
        {
          id: "event-1",
          conversationId: "1-2",
          senderId: "user-2",
          createdAtMs: 123,
          encodedEvent: "ciphertext",
        },
      ],
      nextCursor: "next",
      hasMore: true,
    });
  });

  it("uses a bare initial participant-events request and preserves partial encrypted coverage", async () => {
    const events = Array.from({ length: 23 }, (_, index) => ({
      id: `event-${index}`,
      conversation_id: "direct-conversation",
      sender_id: index < 8 ? participantUserId : viewerUserId,
      created_at_msec: String(1_700_000_000_000 + index),
      encoded_event: `ciphertext-${index}`,
    }));
    const requests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      const payload = url.includes("/events")
        ? { data: events, hasMore: true }
        : PUBLIC_KEYS_PAYLOAD;
      return new Response(JSON.stringify(payload), { status: 200 });
    }) as typeof fetch;

    try {
      const bundle = await getXChatBrowserDecryptBundle(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId
      );

      const eventRequests = requests.filter((request) =>
        request.includes(`/2/chat/conversations/${participantUserId}/events`)
      );
      expect(eventRequests).toHaveLength(1);
      expect(new URL(eventRequests[0]!).search).toBe("");
      expect(bundle.events).toHaveLength(23);
      expect(
        bundle.events.filter((event) => event.senderId === participantUserId)
      ).toHaveLength(8);
      expect(
        bundle.events.filter((event) => event.senderId === viewerUserId)
      ).toHaveLength(15);
      expect(bundle.hasMore).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
