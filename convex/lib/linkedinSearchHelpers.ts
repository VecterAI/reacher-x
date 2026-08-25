// Centralized LinkdAPI search knobs so workflow allocation and transport
// pagination stay aligned as we tune LinkedIn discovery volume.

export const LINKEDIN_PEOPLE_DEFAULT_COUNT = 50;
export const LINKEDIN_PEOPLE_MAX_PAGES_PER_QUERY = 3;

export const LINKEDIN_POSTS_DEFAULT_PAGE_SIZE = 10;
export const LINKEDIN_POSTS_MAX_PAGES_PER_QUERY = 3;
export const LINKEDIN_PROSPECT_SAVE_BATCH_SIZE = 25;

function normalizePositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : fallback;
}

export function getNextLinkedInPeopleSearchStart(
  currentStart: number,
  count: number = LINKEDIN_PEOPLE_DEFAULT_COUNT
) {
  return (
    normalizePositiveInteger(currentStart, 0) +
    normalizePositiveInteger(count, LINKEDIN_PEOPLE_DEFAULT_COUNT)
  );
}

export function getNextLinkedInPostsSearchStart(
  currentStart: number,
  pageSize: number = LINKEDIN_POSTS_DEFAULT_PAGE_SIZE
) {
  return (
    normalizePositiveInteger(currentStart, 0) +
    normalizePositiveInteger(pageSize, LINKEDIN_POSTS_DEFAULT_PAGE_SIZE)
  );
}

export function chunkLinkedInProspectsForSave<T>(prospects: T[]): T[][] {
  return chunkLinkedInItems(prospects, LINKEDIN_PROSPECT_SAVE_BATCH_SIZE);
}

export function chunkLinkedInItems<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  const normalizedBatchSize = normalizePositiveInteger(batchSize, 1);

  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    batches.push(items.slice(index, index + normalizedBatchSize));
  }

  return batches;
}

export function normalizeLinkedInPostQueryStats<
  T extends {
    query: string;
    postsFound: number;
    success: boolean;
    error?: string;
  },
>(stats: T[], persistenceError?: string) {
  return stats.map((stat) => ({
    query: stat.query,
    postsFound: stat.postsFound,
    success: persistenceError ? false : stat.success,
    error: persistenceError ?? stat.error,
  }));
}
