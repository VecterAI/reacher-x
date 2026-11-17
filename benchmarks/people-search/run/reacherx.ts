import { z } from "zod";
import type { ExportedProspect } from "../../core/execution/convex";
import { domainKey } from "../../core/judging/identity";
import { seededRandom, shuffled } from "../../core/random";
import {
  entitySchema,
  type BenchmarkEntity,
  type Candidate,
  type EntityType,
  type Evidence,
} from "../../core/types";

// Evidence passed to judges per result: verified sources only, bounded in size.
const MAX_EVIDENCE_ITEMS = 5;
const MAX_EVIDENCE_CHARS = 2_000;

const socialProfilesSchema = z
  .object({
    linkedin: z.object({ url: z.string() }).partial().optional(),
    twitter: z.object({ url: z.string() }).partial().optional(),
  })
  .nullable()
  .catch(null);

const qualificationSourceSchema = z.object({
  sourceUrl: z.string(),
  evidenceUrl: z.string().optional(),
  text: z.string(),
  publishedAt: z.string().optional(),
  verifiedAt: z.number(),
});

const isoOrNull = (value: string | number | undefined) => {
  if (value === undefined) return null;
  const time = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

const httpUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

/** Verified qualification sources as judge evidence. Scores and reasoning are left out. */
function sourcesAsEvidence(sources: readonly unknown[]): Evidence[] {
  return sources
    .flatMap((source) => {
      const parsed = qualificationSourceSchema.safeParse(source);
      const url = parsed.success
        ? (httpUrl(parsed.data.evidenceUrl) ?? httpUrl(parsed.data.sourceUrl))
        : null;
      if (!parsed.success || !url) return [];
      return [
        {
          url,
          text: Array.from(parsed.data.text)
            .slice(0, MAX_EVIDENCE_CHARS)
            .join(""),
          publishedAt: isoOrNull(parsed.data.publishedAt),
          retrievedAt: new Date(parsed.data.verifiedAt).toISOString(),
        },
      ];
    })
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((item, index) => ({ id: `reacherx-${index + 1}`, ...item }));
}

/**
 * Proposal 5.2: ReacherX results in the same typed shape as every other tool.
 * Only factual fields are kept; returns null for a prospect that has no name or
 * whose type was never resolved, since it cannot be graded as either.
 */
export function toCandidate(
  prospect: ExportedProspect,
  rank: number
): Candidate | null {
  const name = prospect.displayName?.trim();
  if (
    !name ||
    (prospect.prospectType !== "individual" &&
      prospect.prospectType !== "organization")
  )
    return null;
  const profiles = socialProfilesSchema.parse(prospect.socialProfiles);
  const profileUrl =
    httpUrl(profiles?.linkedin?.url) ?? httpUrl(profiles?.twitter?.url);
  const common = {
    name,
    location: prospect.location,
    description: prospect.briefIntro,
    evidence: sourcesAsEvidence(prospect.qualificationSources),
  };
  const entity: BenchmarkEntity =
    prospect.prospectType === "individual"
      ? {
          ...common,
          prospectType: "individual",
          profileUrl,
          title: prospect.title,
          employer: prospect.company,
        }
      : {
          ...common,
          prospectType: "organization",
          profileUrl: profileUrl ?? httpUrl(prospect.websiteUrl),
          domain: domainKey(prospect.websiteUrl),
          industry: null,
          employeeCount: null,
        };
  return {
    sourceId: prospect.id,
    rank,
    discoveredAt: new Date(prospect.createdAt).toISOString(),
    entity: entitySchema.parse(entity),
  };
}

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
