/**
 * Prospect rows contain raw provider payloads and every write also maintains
 * summary and analytics read models. Keep each transaction well below the
 * Convex 16 MiB read budget even when a provider returns unusually large rows.
 */
export const PROSPECT_WRITE_TRANSACTION_BATCH_SIZE = 1;
export const PROSPECT_PERSISTENCE_MAX_ATTEMPTS = 5;
const PROSPECT_PERSISTENCE_RETRY_BASE_MS = 100;

export function isProspectPersistenceOccError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Documents read from or written to .* changed while this mutation was being run/i.test(
      error.message
    )
  );
}

export function getProspectPersistenceRetryDelayMs(
  failedAttempt: number,
  jitterFraction = Math.random()
) {
  const normalizedAttempt = Math.max(1, Math.floor(failedAttempt));
  const normalizedJitter = Math.max(0, Math.min(1, jitterFraction));
  return (
    PROSPECT_PERSISTENCE_RETRY_BASE_MS * 2 ** (normalizedAttempt - 1) +
    Math.floor(normalizedJitter * PROSPECT_PERSISTENCE_RETRY_BASE_MS)
  );
}

/**
 * Retry the one-row, idempotent prospect mutation after Convex has exhausted
 * its built-in OCC retries. Stable provider identity makes an uncertain
 * committed response converge on the same prospect on the next attempt.
 */
export async function persistProspectWithRetry<T>(
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
