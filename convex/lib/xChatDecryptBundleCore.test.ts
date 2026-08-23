import { Client } from "@xdevplatform/xdk";
import { describe, expect, it } from "vitest";
import {
  buildSanitizedXChatJuiceboxConfig,
  getXChatRealmAuthToken,
  normalizeXChatEncryptedEventPage,
  normalizeXChatPublicKeyRecords,
} from "./xChatDecryptBundleCore";
import {
  getXChatBrowserDecryptBundle,
  XChatConfigurationError,
  XChatProviderRequestError,
} from "./xdkTwitterProvider";

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

  it("includes provider key-change envelopes before message envelopes", () => {
    expect(
      normalizeXChatEncryptedEventPage({
        data: [
          {
            id: "message-1",
            encoded_event: "message-envelope",
          },
          {
            id: "duplicate-key-event",
            encoded_event: "key-envelope",
          },
        ],
        meta: {
          conversation_key_events: ["key-envelope", "rotated-key-envelope"],
        },
      }).events
    ).toEqual([
      { encodedEvent: "key-envelope" },
      { encodedEvent: "rotated-key-envelope" },
      { id: "message-1", encodedEvent: "message-envelope" },
    ]);
  });

  it("accepts the camelCase key-event metadata returned by X clients", () => {
    expect(
      normalizeXChatEncryptedEventPage({
        meta: { conversationKeyEvents: ["camel-key-envelope"] },
      }).events
    ).toEqual([{ encodedEvent: "camel-key-envelope" }]);
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
        : url.includes(`/2/users/${viewerUserId}/public_keys`)
          ? {
              data: [
                {
                  ...PUBLIC_KEYS_PAYLOAD.data[0],
                  user_id: viewerUserId,
                },
              ],
            }
          : {
              data: [
                {
                  ...PUBLIC_KEYS_PAYLOAD.data[0],
                  user_id: participantUserId,
                  public_key_version: "41",
                  juicebox_config: undefined,
                },
              ],
            };
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
      expect(bundle.availability).toBe("available");
      if (bundle.availability !== "available") {
        throw new Error("Expected an available encrypted XChat bundle");
      }

      const eventRequests = requests.filter((request) =>
        request.includes(`/2/chat/conversations/${participantUserId}/events`)
      );
      expect(eventRequests).toHaveLength(1);
      expect(
        requests.filter((request) =>
          request.includes(`/2/users/${viewerUserId}/public_keys`)
        )
      ).toHaveLength(1);
      expect(
        requests.filter((request) =>
          request.includes(`/2/users/${participantUserId}/public_keys`)
        )
      ).toHaveLength(1);
      expect(
        requests.some((request) => request.includes("/2/users/public_keys"))
      ).toBe(false);
      expect(new URL(eventRequests[0]!).search).toBe("");
      expect(bundle.events).toHaveLength(23);
      expect(
        bundle.events.filter((event) => event.senderId === participantUserId)
      ).toHaveLength(8);
      expect(
        bundle.events.filter((event) => event.senderId === viewerUserId)
      ).toHaveLength(15);
      expect(bundle.hasMore).toBe(true);
      expect(bundle.eventPagesFetched).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns unavailable only when empty history and viewer keys are both absent", async () => {
    const requests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      const payload = url.includes("/events")
        ? { data: [], meta: {} }
        : { data: [] };
      return new Response(JSON.stringify(payload), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      await expect(
        getXChatBrowserDecryptBundle(
          {
            client: new Client({ accessToken: "test-user-access-token" }),
            xUserId: viewerUserId,
          },
          participantUserId
        )
      ).resolves.toEqual({
        availability: "unavailable",
        reason: "not_configured",
      });
      expect(requests).toHaveLength(3);
      expect(
        requests.filter((request) => request.includes("public_keys"))
      ).toHaveLength(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps a configured but empty XChat conversation unlock-gated", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      const payload = url.includes("/events")
        ? { data: [], meta: {} }
        : url.includes(`/2/users/${viewerUserId}/public_keys`)
          ? {
              data: [
                {
                  ...PUBLIC_KEYS_PAYLOAD.data[0],
                  user_id: viewerUserId,
                },
              ],
            }
          : { data: [] };
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
      expect(bundle).toMatchObject({
        availability: "available",
        viewerUserId,
        participantUserId,
        events: [],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not downgrade encrypted history when viewer keys are unavailable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.includes("/events")
            ? {
                data: [
                  {
                    id: "encrypted-message",
                    encoded_event: "ciphertext",
                  },
                ],
              }
            : { data: [] }
        ),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const request = getXChatBrowserDecryptBundle(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId
      );
      await expect(request).rejects.toBeInstanceOf(XChatConfigurationError);
      await expect(request).rejects.toMatchObject({
        code: "keys_unavailable",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps provider failures structured instead of treating them as legacy", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ detail: "rate limited" }), {
        status: 429,
        headers: { "x-rate-limit-reset": "123" },
      })) as typeof fetch;

    try {
      const request = getXChatBrowserDecryptBundle(
        {
          client: new Client({ accessToken: "test-user-access-token" }),
          xUserId: viewerUserId,
        },
        participantUserId
      );
      await expect(request).rejects.toBeInstanceOf(XChatProviderRequestError);
      await expect(request).rejects.toMatchObject({
        details: { code: "rate_limited", retryAt: 123_000 },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
