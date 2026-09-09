import type { Tweet } from "../../features/threads/types";
import { logger } from "../../shared/lib/logger";
import { fetchPublicTweetsFromXApi } from "./publicTweetXCore";

const publicSocialLogger = logger.withScope("publicSocial");

type OrderedConfigRow = {
  position: number;
  isActive: boolean;
  tweetId?: string;
};

export type NormalizedOrderedConfigEntry = {
  id: string;
  position: number;
};

export function normalizeOrderedConfigEntries<
  T extends OrderedConfigRow,
  K extends "tweetId",
>(
  rows: T[],
  key: K,
  options?: {
    includeInactive?: boolean;
    limit?: number;
    excludeId?: string;
  }
): NormalizedOrderedConfigEntry[] {
  const includeInactive = options?.includeInactive ?? false;
  const excludeId = options?.excludeId?.trim();
  const deduped = new Set<string>();
  const normalizedEntries: NormalizedOrderedConfigEntry[] = [];

  const sortedRows = [...rows].sort(
    (left, right) => left.position - right.position
  );
  for (const row of sortedRows) {
    if (!includeInactive && row.isActive !== true) {
      continue;
    }
    const rawValue = row[key];
    const id = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!id || id === excludeId || deduped.has(id)) {
      continue;
    }
    deduped.add(id);
    normalizedEntries.push({ id, position: row.position });
    if (
      typeof options?.limit === "number" &&
      normalizedEntries.length >= options.limit
    ) {
      break;
    }
  }

  return normalizedEntries;
}

export function normalizeOrderedConfigIds<
  T extends OrderedConfigRow,
  K extends "tweetId",
>(
  rows: T[],
  key: K,
  options?: {
    includeInactive?: boolean;
    limit?: number;
    excludeId?: string;
  }
): string[] {
  return normalizeOrderedConfigEntries(rows, key, options).map(
    (entry) => entry.id
  );
}

export async function fetchPublicTestimonialTweetsByIds(
  tweetIds: string[]
): Promise<Tweet[]> {
  if (tweetIds.length === 0) {
    return [];
  }

  try {
    return await fetchPublicTweetsFromXApi(tweetIds);
  } catch (error) {
    publicSocialLogger.warn(
      "[publicSocial] Failed to fetch public tweets from X API",
      {
        tweetIds,
        error,
      }
    );
    return [];
  }
}
