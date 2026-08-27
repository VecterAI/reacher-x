/**
 * Prospect rows contain raw provider payloads and every write also maintains
 * summary and analytics read models. Keep each transaction well below the
 * Convex 16 MiB read budget even when a provider returns unusually large rows.
 */
export const PROSPECT_WRITE_TRANSACTION_BATCH_SIZE = 5;

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
