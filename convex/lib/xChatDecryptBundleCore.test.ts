import { describe, expect, it } from "vitest";
import {
  buildSanitizedXChatJuiceboxConfig,
  getXChatRealmAuthToken,
  normalizeXChatEncryptedEventPage,
  normalizeXChatPublicKeyRecords,
} from "./xChatDecryptBundleCore";

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
    });
  });
});
