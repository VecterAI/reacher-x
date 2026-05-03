// convex/lib/retrier.ts
// ActionRetrier instance for reliable external API calls with automatic retry

import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

/**
 * Shared ActionRetrier instance for all external API calls.
 *
 * Configuration:
 * - initialBackoffMs: 1000ms (1 second initial delay after failure)
 * - base: 2 (exponential backoff: 1s → 2s → 4s)
 * - maxFailures: 3 (maximum retry attempts before giving up)
 *
 * Usage:
 * ```typescript
 * import { retrier } from "./lib/retrier";
 *
 * // In an action or mutation:
 * const runId = await retrier.run(ctx, internal.myModule.myInternalAction, { arg: "value" });
 * ```
 */
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: 3,
});
