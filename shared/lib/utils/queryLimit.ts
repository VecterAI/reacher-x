// shared/lib/utils/queryLimit.ts
// Minimal query limit utilities for SearchInput component

export const QUERY_CHAR_LIMIT = 512; // Twitter API limit

export function computeEffectiveLength(
  query: string,
  exactMatch: boolean
): number {
  // If exact match, add 2 for quotes
  return exactMatch ? query.length + 2 : query.length;
}
