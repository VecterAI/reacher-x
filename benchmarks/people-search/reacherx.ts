import type { ExportedProspect } from "../core/convex";
import { seededRandom, shuffled } from "../core/random";
import type { EntityType } from "../core/types";

/**
 * Proposal 5.7: ReacherX's judged results are its best-fit qualified entities
 * of the task's type. A company task never takes an individual, or the reverse;
 * prospects whose type is still unknown are not counted as either.
 */
export function selectReacherXTopK(
  prospects: readonly ExportedProspect[],
  entityType: EntityType,
  k: 5 | 10 = 5
) {
  return prospects
    .filter(
      (prospect) =>
        prospect.qualificationStatus === "qualified" &&
        prospect.prospectType === entityType
    )
    .sort(
      (a, b) =>
        (b.qualificationScore ?? -1) - (a.qualificationScore ?? -1) ||
        a.createdAt - b.createdAt
    )
    .slice(0, k);
}

/**
 * Proposal 5.7: up to `perCycle` rejected prospects per cycle, drawn with the
 * frozen seed, to measure good matches ReacherX turned away. `cycleOf`
 * assigns each prospect to the cycle that found it, or null when unknown.
 */
export function sampleRejected(
  prospects: readonly ExportedProspect[],
  cycleOf: (prospect: ExportedProspect) => number | null,
  seed: number,
  perCycle = 3
) {
  const byCycle = new Map<number, ExportedProspect[]>();
  for (const prospect of prospects) {
    const cycle = cycleOf(prospect);
    if (prospect.qualificationStatus !== "disqualified" || cycle === null)
      continue;
    byCycle.set(cycle, [...(byCycle.get(cycle) ?? []), prospect]);
  }
  const random = seededRandom(seed);
  return [...byCycle.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([cycle, rejected]) =>
      // Stable input order first, so the draw depends only on the seed.
      shuffled(
        [...rejected].sort((a, b) => a.id.localeCompare(b.id)),
        random
      )
        .slice(0, perCycle)
        .map((prospect) => ({ cycle, prospect }))
    );
}
