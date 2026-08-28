import { describe, expect, test } from "vitest";
import {
  chunkProspectsForPersistence,
  getProspectPersistenceRetryDelayMs,
  isProspectPersistenceOccError,
  persistProspectWithRetry,
  PROSPECT_WRITE_TRANSACTION_BATCH_SIZE,
} from "./prospectPersistenceHelpers";

describe("prospect persistence batching", () => {
  test("keeps every prospect while bounding each transaction", () => {
    const prospects = Array.from({ length: 66 }, (_, index) => ({ index }));
    const batches = chunkProspectsForPersistence(prospects);

    expect(
      batches.every(
        (batch) => batch.length <= PROSPECT_WRITE_TRANSACTION_BATCH_SIZE
      )
    ).toBe(true);
    expect(batches.flat()).toEqual(prospects);
  });

  test("does not create an empty transaction", () => {
    expect(chunkProspectsForPersistence([])).toEqual([]);
  });

  test("uses one prospect per transaction to bound heavyweight reads", () => {
    expect(PROSPECT_WRITE_TRANSACTION_BATCH_SIZE).toBe(1);
    expect(chunkProspectsForPersistence([1, 2, 3])).toEqual([[1], [2], [3]]);
  });

  test("retries permanent OCC failures and preserves the committed result", async () => {
    let attempts = 0;
    const result = await persistProspectWithRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error(
          "Documents read from or written to the prospects table changed while this mutation was being run"
        );
      }
      return "saved";
    });

    expect(result).toBe("saved");
    expect(attempts).toBe(3);
  });

  test("does not retry non-OCC failures", async () => {
    let attempts = 0;
    await expect(
      persistProspectWithRetry(async () => {
        attempts += 1;
        throw new Error("validation failed");
      })
    ).rejects.toThrow("validation failed");
    expect(attempts).toBe(1);
  });

  test("bounds retry delay deterministically", () => {
    expect(getProspectPersistenceRetryDelayMs(1, 0)).toBe(100);
    expect(getProspectPersistenceRetryDelayMs(3, 1)).toBe(500);
    expect(
      isProspectPersistenceOccError(
        new Error(
          "Documents read from or written to workspaceStatsStripes changed while this mutation was being run"
        )
      )
    ).toBe(true);
  });
});
