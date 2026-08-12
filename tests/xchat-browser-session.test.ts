import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  cacheVerifiedXChatBrowserSession,
  createInFlightRealmAuthTokenProvider,
  getXChatBrowserSession,
  lockXChatInBrowser,
  type XChatDecryptBundle,
} from "../features/agent/lib/xChatBrowserSession";

function bundle(
  overrides: Partial<XChatDecryptBundle> = {}
): XChatDecryptBundle {
  return {
    viewerUserId: "viewer-1",
    participantUserId: "participant-1",
    conversationId: "conversation-1",
    signingKeyVersion: "key-1",
    juiceboxConfig: "{}",
    signingKeys: [],
    events: [],
    eventPagesFetched: 1,
    hasMore: true,
    ...overrides,
  };
}

afterEach(() => {
  lockXChatInBrowser();
});

test("a newer XChat session replaces stale plaintext for the same prospect", () => {
  const first = cacheVerifiedXChatBrowserSession({
    prospectId: "prospect-1",
    bundle: bundle(),
    messages: [
      {
        id: "event-1",
        senderId: "participant-1",
        direction: "received",
        occurredAt: 1_000,
        text: "Verified XChat text",
      },
    ],
    decryptionErrorCount: 0,
  });
  const second = cacheVerifiedXChatBrowserSession({
    prospectId: "prospect-1",
    bundle: bundle({ conversationId: "conversation-2" }),
    messages: [],
    decryptionErrorCount: 2,
  });

  assert.equal(getXChatBrowserSession({ prospectId: "prospect-1" }), second);
  assert.equal(first.conversationId, "conversation-1");
  assert.equal(
    getXChatBrowserSession({
      prospectId: "prospect-1",
      conversationId: "conversation-1",
    }),
    null
  );
  assert.equal(
    getXChatBrowserSession({
      prospectId: "prospect-2",
      conversationId: "conversation-1",
    }),
    null
  );
});

test("lock frees the browser-only XChat view state", () => {
  cacheVerifiedXChatBrowserSession({
    prospectId: "prospect-1",
    bundle: bundle(),
    messages: [],
    decryptionErrorCount: 0,
  });

  lockXChatInBrowser();

  assert.equal(getXChatBrowserSession({ prospectId: "prospect-1" }), null);
});

test("an unresolved session target never receives another prospect's session", () => {
  const session = cacheVerifiedXChatBrowserSession({
    prospectId: "prospect-1",
    bundle: bundle(),
    messages: [],
    decryptionErrorCount: 0,
  });

  assert.equal(getXChatBrowserSession({}), null);
  assert.equal(getXChatBrowserSession({ prospectId: null }), null);
  assert.equal(getXChatBrowserSession({ prospectId: "prospect-2" }), null);
  assert.equal(getXChatBrowserSession({ prospectId: "prospect-1" }), session);
});

test("concurrent XChat token requests for the same realm share one backend call", async () => {
  let backendCallCount = 0;
  let resolveToken: ((token: string) => void) | undefined;
  const getRealmAuthToken = createInFlightRealmAuthTokenProvider(async () => {
    backendCallCount += 1;
    return await new Promise<string>((resolve) => {
      resolveToken = resolve;
    });
  });

  const firstRequest = getRealmAuthToken("realm-1");
  const duplicateRequest = getRealmAuthToken("realm-1");
  await Promise.resolve();

  assert.equal(firstRequest, duplicateRequest);
  assert.equal(backendCallCount, 1);
  resolveToken?.("realm-token");
  assert.deepEqual(await Promise.all([firstRequest, duplicateRequest]), [
    "realm-token",
    "realm-token",
  ]);
});

test("XChat token requests for distinct realms remain independent", async () => {
  const requestedRealmIds: string[] = [];
  const getRealmAuthToken = createInFlightRealmAuthTokenProvider(
    async (realmId) => {
      requestedRealmIds.push(realmId);
      return `token-for-${realmId}`;
    }
  );

  assert.deepEqual(
    await Promise.all([
      getRealmAuthToken("realm-1"),
      getRealmAuthToken("realm-2"),
    ]),
    ["token-for-realm-1", "token-for-realm-2"]
  );
  assert.deepEqual(requestedRealmIds, ["realm-1", "realm-2"]);
});

test("a rejected XChat realm token request is evicted for retry", async () => {
  let backendCallCount = 0;
  const getRealmAuthToken = createInFlightRealmAuthTokenProvider(async () => {
    backendCallCount += 1;
    if (backendCallCount === 1) {
      throw new Error("Unauthorized");
    }
    return "fresh-realm-token";
  });

  const firstRequest = getRealmAuthToken("realm-1");
  const duplicateRequest = getRealmAuthToken("realm-1");
  const rejected = await Promise.allSettled([firstRequest, duplicateRequest]);

  assert.equal(backendCallCount, 1);
  assert.deepEqual(
    rejected.map((result) => result.status),
    ["rejected", "rejected"]
  );
  assert.equal(await getRealmAuthToken("realm-1"), "fresh-realm-token");
  assert.equal(backendCallCount, 2);
});
