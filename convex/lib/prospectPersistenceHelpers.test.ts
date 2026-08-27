import { describe, expect, test } from "vitest";
import {
  chunkProspectsForPersistence,
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
});
