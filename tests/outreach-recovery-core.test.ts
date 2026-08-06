import assert from "node:assert/strict";
import test from "node:test";
import {
  getNewRecoveryArtifactIds,
  getRecoveryNextCheckDelayMs,
  parseRecoveryArtifactIds,
  serializeRecoveryArtifactIds,
  TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS,
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

test("manual detection starts quickly while response monitoring backs off", () => {
  assert.equal(getRecoveryNextCheckDelayMs("detecting_outbound", 1), 15_000);
  assert.equal(getRecoveryNextCheckDelayMs("detecting_outbound", 20), 900_000);
  assert.equal(
    getRecoveryNextCheckDelayMs("detecting_outbound", 1, "twitter_manual_reply"),
    TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS
  );
  assert.equal(
    getRecoveryNextCheckDelayMs(
      "detecting_outbound",
      20,
      "twitter_manual_reply"
    ),
    TWITTER_MANUAL_REPLY_POLL_INTERVAL_MS
  );
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
