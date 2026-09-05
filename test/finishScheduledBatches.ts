import type { convexTest } from "convex-test";
import { vi } from "vitest";

/** For workflows whose actions do not sleep internally. Advance between settled
 * batches so module loading cannot make a fake-clock heartbeat expire. */
export async function finishScheduledBatches(
  t: ReturnType<typeof convexTest>,
  maxBatches = 100
) {
  for (let batch = 0; batch < maxBatches; batch++) {
    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();
    if (vi.getTimerCount() === 0) return;
  }
  throw new Error(
    `Scheduled functions did not settle after ${maxBatches} batches`
  );
}
