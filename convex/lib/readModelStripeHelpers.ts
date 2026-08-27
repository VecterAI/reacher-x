import { createStableHash } from "./memoryHelpers";

/**
 * Read-model writes are spread across deterministic stripes so independent
 * source documents do not contend on one workspace-wide rollup row. Keeping a
 * source on the same stripe makes remove/add updates exact and idempotent.
 */
export const READ_MODEL_STRIPE_COUNT = 32;

export function getReadModelStripe(sourceKey: string): number {
  const hash = createStableHash(sourceKey);
  return Number.parseInt(hash, 16) % READ_MODEL_STRIPE_COUNT;
}
