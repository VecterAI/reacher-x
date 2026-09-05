import { afterEach, describe, expect, test, vi } from "vitest";
import {
  chunkProspectsForPersistence,
  getProspectPersistenceRetryDelayMs,
  isProspectPersistenceOccError,
  persistProspectWithRetry,
  PROSPECT_WRITE_TRANSACTION_BATCH_SIZE,
  PROSPECT_PERSISTENCE_MAX_ATTEMPTS,
} from "./prospectPersistenceHelpers";

describe("prospect persistence batching", () => {
  afterEach(() => vi.useRealTimers());

  test("recognizes structured OCC errors without retrying other error codes", () => {
    expect(
      isProspectPersistenceOccError(
        new Error(
          JSON.stringify({
            code: "OptimisticConcurrencyControlFailure",
            message:
              "Data read or written in this mutation changed while it was being run.",
          })
        )
      )
    ).toBe(true);
    expect(
      isProspectPersistenceOccError(
        new Error(
          JSON.stringify({
            code: "ValidationError",
            message: "Invalid argument",
          })
        )
      )
    ).toBe(false);
    expect(
      isProspectPersistenceOccError(new Error("network disconnected"))
    ).toBe(false);
  });

  test("stops after the bounded retry budget", async () => {
    vi.useFakeTimers();
    const error = new Error(
      JSON.stringify({ code: "OptimisticConcurrencyControlFailure" })
    );
    const persist = vi.fn().mockRejectedValue(error);
    const assertion = expect(persistProspectWithRetry(persist)).rejects.toBe(
      error
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(persist).toHaveBeenCalledTimes(PROSPECT_PERSISTENCE_MAX_ATTEMPTS);
  });
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
    expect(getProspectPersistenceRetryDelayMs(1, 0)).toBe(50);
    expect(getProspectPersistenceRetryDelayMs(3, 1)).toBe(400);
    expect(getProspectPersistenceRetryDelayMs(7, 0)).toBe(3200);
    expect(getProspectPersistenceRetryDelayMs(7, 1)).toBe(6400);
    expect(
      isProspectPersistenceOccError(
        new Error(
          "Documents read from or written to workspaceStatsStripes changed while this mutation was being run"
        )
      )
    ).toBe(true);
  });
});
