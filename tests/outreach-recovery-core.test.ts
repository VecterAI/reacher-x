import assert from "node:assert/strict";
import test from "node:test";
import {
  extractActivityCreatedPost,
  getNewRecoveryArtifactIds,
  getRecoveryNextCheckDelayMs,
  matchesTwitterManualReplyRecovery,
  parseRecoveryArtifactIds,
  serializeRecoveryArtifactIds,
} from "../convex/lib/outreachRecoveryCore";

test("manual X reconciliation only considers reply ids created after handoff", () => {
  const baseline = serializeRecoveryArtifactIds(["old-1", "old-2"]);

  assert.deepEqual(
    getNewRecoveryArtifactIds(["old-2", "new-1", "new-1", "new-2"], baseline),
    ["new-1", "new-2"]
  );
});

test("recovery artifact snapshots are bounded and tolerate invalid data", () => {
  const ids = Array.from({ length: 150 }, (_, index) => `reply-${index}`);
  assert.equal(
    parseRecoveryArtifactIds(serializeRecoveryArtifactIds(ids)).size,
    100
  );
  assert.deepEqual([...parseRecoveryArtifactIds("not-json")], []);
});

test("LinkedIn outbound detection starts quickly while response monitoring backs off", () => {
  assert.equal(getRecoveryNextCheckDelayMs("detecting_outbound", 1), 15_000);
  assert.equal(getRecoveryNextCheckDelayMs("detecting_outbound", 20), 900_000);
  assert.equal(getRecoveryNextCheckDelayMs("awaiting_response", 1), 300_000);
  assert.equal(getRecoveryNextCheckDelayMs("awaiting_response", 12), 1_800_000);
});

test("LinkedIn connection recovery uses sparse webhook-safe fallback checks", () => {
  assert.equal(
    getRecoveryNextCheckDelayMs("awaiting_connection", 0),
    28_800_000
  );
  assert.equal(
    getRecoveryNextCheckDelayMs("awaiting_connection", 12),
    259_200_000
  );
});

test("Activity post.create envelopes extract replied_to targets", () => {
  const post = extractActivityCreatedPost({
    event_type: "post.create",
    filter: { user_id: "1743216568451125248" },
    payload: {
      id: "2081000000000000001",
      author_id: "1743216568451125248",
      text: "Thanks for sharing this",
      created_at: "2026-08-06T12:00:00.000Z",
      conversation_id: "2080000000000000000",
      referenced_tweets: [{ type: "replied_to", id: "2080000000000000000" }],
    },
  });

  assert.ok(post);
  assert.equal(post.postId, "2081000000000000001");
  assert.equal(post.repliedToPostId, "2080000000000000000");
  assert.equal(post.authorId, "1743216568451125248");
  assert.equal(post.createdAtMs, Date.parse("2026-08-06T12:00:00.000Z"));
});

test("Activity reply matching requires connected author and target tweet", () => {
  const post = {
    postId: "2081000000000000001",
    authorId: "1743216568451125248",
    repliedToPostId: "2080000000000000000",
    createdAtMs: Date.parse("2026-08-06T12:00:00.000Z"),
  };

  assert.equal(
    matchesTwitterManualReplyRecovery({
      post,
      sourcePostId: "2080000000000000000",
      connectedXUserId: "1743216568451125248",
      startedAt: Date.parse("2026-08-06T11:59:00.000Z"),
    }),
    true
  );

  assert.equal(
    matchesTwitterManualReplyRecovery({
      post,
      sourcePostId: "2080000000000000000",
      connectedXUserId: "999",
      startedAt: Date.parse("2026-08-06T11:59:00.000Z"),
    }),
    false
  );

  assert.equal(
    matchesTwitterManualReplyRecovery({
      post: { ...post, repliedToPostId: undefined },
      sourcePostId: "2080000000000000000",
      connectedXUserId: "1743216568451125248",
      startedAt: Date.parse("2026-08-06T11:59:00.000Z"),
    }),
    false
  );
});
