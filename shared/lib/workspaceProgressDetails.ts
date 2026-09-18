export function formatAverageFitScoreDetail(
  averageFitScore: number
): string | null {
  return averageFitScore > 0 ? `Avg. match: ${averageFitScore}/100` : null;
}

export function formatEnrichedProfilesDetail(enrichedCount: number): string {
  return `${enrichedCount === 1 ? "1 profile" : `${enrichedCount} profiles`} ready`;
}
