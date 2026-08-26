export function formatAverageFitScoreDetail(
  averageFitScore: number
): string | null {
  return averageFitScore > 0 ? `Avg. fit: ${averageFitScore}/100` : null;
}

export function formatEnrichedProfilesDetail(enrichedCount: number): string {
  return `${enrichedCount === 1 ? "Profile" : "Profiles"} enriched`;
}
