import type { Infer } from "convex/values";
import { escapeRegExp } from "../../shared/lib/utils/text/tweetText";
import type { workspaceTargetingSpecValidator } from "../validators";
import { normalizeLinkedInPostAuthorJobTitle } from "./linkedinSearchHelpers";

export type WorkspaceTargetingSpec = Infer<
  typeof workspaceTargetingSpecValidator
>;
export type TargetingCriterion = WorkspaceTargetingSpec["criteria"][number];
export type DiscoveryStage = "strict" | "balanced" | "broad";

const MAX_CRITERIA = 12;
const MAX_TERMS_PER_CRITERION = 12;
const MAX_SEARCH_HINTS_PER_GROUP = 20;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value ? normalizeText(value) : "";
  return normalized || undefined;
}

function uniqueText(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function getRequiredSearchHint(
  values: readonly string[],
  criteria: WorkspaceTargetingSpec["criteria"]
): string | undefined {
  const candidates = uniqueText(values, 2);
  if (candidates.length !== 1) {
    return undefined;
  }

  const [candidate] = candidates;
  const normalizedCandidate = candidate.toLowerCase();
  const candidatePattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(normalizedCandidate)}($|[^\\p{L}\\p{N}_])`,
    "iu"
  );
  const isRequired = criteria.some(
    (criterion) =>
      criterion.kind === "required" &&
      criterion.category === "profile_fit" &&
      [criterion.description, ...criterion.terms].some((value) =>
        candidatePattern.test(normalizeText(value))
      )
  );

  return isRequired ? candidate : undefined;
}

function toCriterionId(value: string, index: number): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return normalized || `criterion_${index + 1}`;
}

/**
 * Bounds and normalizes model-produced targeting data. This intentionally does
 * not infer criteria, exclusions, or search terms in application code.
 */
export function normalizeWorkspaceTargetingSpec(
  spec: WorkspaceTargetingSpec
): WorkspaceTargetingSpec {
  const usedIds = new Set<string>();
  const criteria = spec.criteria
    .slice(0, MAX_CRITERIA)
    .map((criterion, index) => {
      const baseId = toCriterionId(criterion.id || criterion.label, index);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId.slice(0, 44)}_${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);

      return {
        ...criterion,
        id,
        label: normalizeText(criterion.label).slice(0, 120),
        description: normalizeText(criterion.description).slice(0, 500),
        weight: Math.min(5, Math.max(1, Math.round(criterion.weight))),
        terms: uniqueText(criterion.terms, MAX_TERMS_PER_CRITERION),
      };
    });
  const locations = uniqueText(
    spec.searchHints.locations,
    MAX_SEARCH_HINTS_PER_GROUP
  );
  const roleTitles = uniqueText(
    spec.searchHints.roleTitles,
    MAX_SEARCH_HINTS_PER_GROUP
  );
  const requiredLocation = getRequiredSearchHint(locations, criteria);
  const requiredRoleTitle = getRequiredSearchHint(roleTitles, criteria);

  return {
    version: 1,
    summary: normalizeText(spec.summary).slice(0, 600),
    criteria,
    searchHints: {
      entities: uniqueText(
        spec.searchHints.entities,
        MAX_SEARCH_HINTS_PER_GROUP
      ),
      activityPhrases: uniqueText(
        spec.searchHints.activityPhrases ?? [
          ...(spec.searchHints.positivePhrases ?? []),
          ...(spec.searchHints.frustrationPhrases ?? []),
        ],
        MAX_SEARCH_HINTS_PER_GROUP
      ),
      roleTitles,
      locations,
      industries: uniqueText(
        spec.searchHints.industries,
        MAX_SEARCH_HINTS_PER_GROUP
      ),
      companyNames: uniqueText(
        spec.searchHints.companyNames,
        MAX_SEARCH_HINTS_PER_GROUP
      ),
      languageCodes: uniqueText(
        spec.searchHints.languageCodes ?? [],
        MAX_SEARCH_HINTS_PER_GROUP
      ),
      exclusionTerms: uniqueText(
        spec.searchHints.exclusionTerms,
        MAX_SEARCH_HINTS_PER_GROUP
      ),
    },
    searchFilters: {
      twitter: {
        language: normalizeOptionalText(spec.searchFilters?.twitter.language),
        location:
          normalizeOptionalText(spec.searchFilters?.twitter.location) ??
          requiredLocation,
      },
      linkedinPeople: {
        location:
          normalizeOptionalText(spec.searchFilters?.linkedinPeople.location) ??
          requiredLocation,
        profileLanguage: normalizeOptionalText(
          spec.searchFilters?.linkedinPeople.profileLanguage
        ),
      },
      linkedinPosts: {
        authorJobTitle: normalizeLinkedInPostAuthorJobTitle(
          spec.searchFilters?.linkedinPosts.authorJobTitle ?? requiredRoleTitle
        ),
        datePosted: spec.searchFilters?.linkedinPosts.datePosted,
      },
    },
  };
}

/**
 * Gives existing workspaces a generic qualification contract until their next
 * targeting regeneration. All values come from workspace-authored content.
 */
export function buildLegacyWorkspaceTargetingSpec(args: {
  description: string;
  profiles: Array<{
    title: string;
    painPoints: string[];
    qualificationKeywords?: string[];
  }>;
}): WorkspaceTargetingSpec {
  const profileTerms = uniqueText(
    args.profiles.flatMap((profile) => [
      profile.title,
      ...profile.painPoints,
      ...(profile.qualificationKeywords ?? []),
    ]),
    MAX_SEARCH_HINTS_PER_GROUP
  );

  return normalizeWorkspaceTargetingSpec({
    version: 1,
    summary: args.description,
    criteria: [
      {
        id: "workspace_intent",
        label: "Matches the workspace intent",
        description: args.description,
        kind: "required",
        category: "intent",
        evidence: "either",
        weight: 5,
        terms: profileTerms,
      },
      {
        id: "profile_alignment",
        label: "Matches an intended profile",
        description:
          "The person's role, organization, or situation aligns with at least one generated workspace profile.",
        kind: "preferred",
        category: "profile_fit",
        evidence: "either",
        weight: 4,
        terms: args.profiles.map((profile) => profile.title),
      },
      {
        id: "current_relevant_signal",
        label: "Shows a current relevant signal",
        description:
          "Recent first-party activity shows a signal relevant to the workspace goal.",
        kind: "preferred",
        category: "timing",
        evidence: "activity",
        weight: 3,
        terms: profileTerms,
      },
    ],
    searchHints: {
      entities: [],
      activityPhrases: profileTerms,
      roleTitles: args.profiles.map((profile) => profile.title),
      locations: [],
      industries: [],
      companyNames: [],
      languageCodes: [],
      exclusionTerms: [],
    },
    searchFilters: {
      twitter: {},
      linkedinPeople: {},
      linkedinPosts: {},
    },
  });
}

export function getDiscoveryStageRank(stage?: DiscoveryStage): number {
  if (stage === "strict") return 0;
  if (stage === "balanced") return 1;
  return 2;
}

export function getStricterDiscoveryStage(
  left: DiscoveryStage,
  right: DiscoveryStage
): DiscoveryStage {
  return getDiscoveryStageRank(left) <= getDiscoveryStageRank(right)
    ? left
    : right;
}

export function getAllowedDiscoveryStages(args: {
  bootstrapCycleCount?: number;
  bootstrapCompletedAt?: number;
}): DiscoveryStage[] {
  if (typeof args.bootstrapCompletedAt === "number") {
    return ["strict", "balanced", "broad"];
  }
  const cycle = Math.max(0, Math.floor(args.bootstrapCycleCount ?? 0));
  if (cycle === 0) return ["strict"];
  if (cycle === 1) return ["strict", "balanced"];
  return ["strict", "balanced", "broad"];
}

/**
 * A people-search result contains profile data but no prospect-authored
 * activity. Do not spend provider calls on that surface when even one explicit
 * requirement can only be proven from activity; those candidates cannot pass
 * the same qualification contract used by the rest of the pipeline.
 */
export function shouldUseLinkedInPeopleDiscovery(
  spec: WorkspaceTargetingSpec | undefined
): boolean {
  return !spec?.criteria.some(
    (criterion) =>
      criterion.kind === "required" && criterion.evidence === "activity"
  );
}
