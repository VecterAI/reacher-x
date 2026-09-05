import { getStringProperty } from "./typeGuards";

/**
 * Prospect rows contain raw provider payloads and every write also maintains
 * summary and analytics read models. Keep each transaction well below the
 * Convex 16 MiB read budget even when a provider returns unusually large rows.
 */
export const PROSPECT_WRITE_TRANSACTION_BATCH_SIZE = 1;
export const PROSPECT_PERSISTENCE_MAX_ATTEMPTS = 8;
const PROSPECT_PERSISTENCE_RETRY_BASE_MS = 100;

export function isProspectPersistenceOccError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Convex also returns a generic message with a structured error code when it
  // cannot attribute the conflict to a particular table. Both mean rollback.
  try {
    const data: unknown = JSON.parse(error.message);
    if (
      getStringProperty(data, "code") === "OptimisticConcurrencyControlFailure"
    )
      return true;
  } catch {
    // Older clients expose only the human-readable table-specific message.
  }
  return /Documents read from or written to .* changed while this mutation was being run/i.test(
    error.message
  );
}

export function getProspectPersistenceRetryDelayMs(
  failedAttempt: number,
  jitterFraction = Math.random()
) {
  const normalizedAttempt = Math.max(1, Math.floor(failedAttempt));
  const normalizedJitter = Math.max(0, Math.min(1, jitterFraction));
  const backoffMs =
    PROSPECT_PERSISTENCE_RETRY_BASE_MS * 2 ** (normalizedAttempt - 1);
  // Scale jitter with the retry window. A fixed 100 ms jitter made concurrent
  // writers collide again at nearly identical exponential retry boundaries.
  return Math.floor(backoffMs * (0.5 + normalizedJitter * 0.5));
}

/**
 * Retry only confirmed OCC transaction rollbacks after Convex exhausts its
 * built-in retries. Never retry validation or ambiguous network failures.
 */
export async function retryOccMutation<T>(
  persist: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= PROSPECT_PERSISTENCE_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await persist();
    } catch (error) {
      lastError = error;
      if (
        !isProspectPersistenceOccError(error) ||
        attempt === PROSPECT_PERSISTENCE_MAX_ATTEMPTS
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, getProspectPersistenceRetryDelayMs(attempt))
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to persist prospect after repeated OCC conflicts");
}

// Existing prospect callers retain their established API.
export const persistProspectWithRetry = retryOccMutation;

export function chunkProspectsForPersistence<T>(prospects: T[]): T[][] {
  const batches: T[][] = [];
  for (
    let index = 0;
    index < prospects.length;
    index += PROSPECT_WRITE_TRANSACTION_BATCH_SIZE
  ) {
    batches.push(
      prospects.slice(index, index + PROSPECT_WRITE_TRANSACTION_BATCH_SIZE)
    );
  }
  return batches;
}
