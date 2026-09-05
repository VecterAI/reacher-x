// Centralized LinkdAPI search knobs so workflow allocation and transport
// pagination stay aligned as we tune LinkedIn discovery volume.

import {
  chunkProspectsForPersistence,
  PROSPECT_WRITE_TRANSACTION_BATCH_SIZE,
} from "./prospectPersistenceHelpers";
import { getNumberProperty, getStringProperty, isRecord } from "./typeGuards";

export const LINKEDIN_PEOPLE_DEFAULT_COUNT = 50;
export const LINKEDIN_PEOPLE_MAX_PAGES_PER_QUERY = 3;

export const LINKEDIN_POSTS_DEFAULT_PAGE_SIZE = 10;
export const LINKEDIN_POSTS_MAX_PAGES_PER_QUERY = 3;
export const LINKEDIN_PROSPECT_SAVE_BATCH_SIZE =
  PROSPECT_WRITE_TRANSACTION_BATCH_SIZE;

export type LinkedInPeopleSearchAttempt = {
  searchMode: "title" | "keyword";
  geoUrn?: string;
  profileLanguage?: string;
};

/**
 * LinkdAPI documents authorJobTitle as one title value, not a Boolean query.
 * Keep Boolean role expressions in the keyword query instead of sending an
 * unsupported value through the provider filter.
 */
export function normalizeLinkedInPostAuthorJobTitle(
  value?: string
): string | undefined {
  const normalized = value?.trim();
  if (!normalized || /\bAND\b/.test(normalized) || /\bor\b/i.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function extractLinkedInGeoId(data: unknown): string | undefined {
  const candidates = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.results)
      ? data.results
      : [];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const id =
      getStringProperty(candidate, "id") ??
      getNumberProperty(candidate, "id")?.toString();
    if (id?.trim()) return id.trim();

    const urn = getStringProperty(candidate, "urn")?.trim();
    if (urn) {
      const urnParts = urn.split(":");
      return urnParts[urnParts.length - 1] || urn;
    }
  }

  return undefined;
}

export function buildLinkedInPeopleSearchAttempts(args: {
  searchModes: readonly ("title" | "keyword")[];
  geoUrn?: string;
  profileLanguage?: string;
}): LinkedInPeopleSearchAttempt[] {
  const filtered = Boolean(args.geoUrn || args.profileLanguage);
  return [
    ...(filtered
      ? args.searchModes.map((searchMode) => ({
          searchMode,
          geoUrn: args.geoUrn,
          profileLanguage: args.profileLanguage,
        }))
      : []),
    ...args.searchModes.map((searchMode) => ({ searchMode })),
  ];
}

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
  return chunkProspectsForPersistence(prospects);
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
