// convex/agent/retrier.ts
// Action retrier for reliable external API calls

import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

/**
 * Action Retrier for external API calls
 *
 * Used for reliable calls to:
 * - bishopi.io (keyword expansion)
 * - socialapi.io (Twitter search)
 * - linkdapi.com (LinkedIn search)
 * - Exa API (URL content extraction)
 *
 * Note: components.actionRetrier type is generated after running `npx convex dev`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const retrier = new ActionRetrier((components as any).actionRetrier, {
  // Log level for debugging
  logLevel: "INFO",
  // Initial retry config (can be overridden per-action)
  initialBackoffMs: 500,
  base: 2,
  maxFailures: 5,
});

