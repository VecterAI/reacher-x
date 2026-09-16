import type { Doc } from "../_generated/dataModel";

type ProspectAnalyticsState = Pick<
  Doc<"prospects">,
  | "platform"
  | "qualificationStatus"
  | "qualifiedAt"
  | "disqualifiedAt"
  | "enrichedAt"
  | "enrichmentStatus"
  | "readyAt"
  | "evidencePosts"
  | "painPoints"
  | "finance"
>;

type ProspectAnalyticsPatch = Partial<
  Pick<
    Doc<"prospects">,
    | "qualificationStatus"
    | "qualifiedAt"
    | "disqualifiedAt"
    | "enrichedAt"
    | "enrichmentStatus"
    | "readyAt"
    | "evidencePosts"
    | "painPoints"
    | "finance"
  >
>;

export type ProspectQualificationActivitySnapshot = {
  latestQualifiedAt?: number;
  latestDisqualifiedAt?: number;
};

const READY_INPUT_FIELDS = [
  "qualificationStatus",
  "qualifiedAt",
  "disqualifiedAt",
  "enrichedAt",
  "enrichmentStatus",
  "readyAt",
  "evidencePosts",
  "painPoints",
  "finance",
] as const;

function hasOwnProperty<Key extends PropertyKey>(
  value: object,
  key: Key
): value is Record<Key, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function countProspectEvidencePosts(
  prospect: Pick<Doc<"prospects">, "evidencePosts" | "painPoints" | "finance">
): number {
  let count = Array.isArray(prospect.evidencePosts)
    ? prospect.evidencePosts.length
    : 0;

  if (Array.isArray(prospect.painPoints)) {
    for (const painPoint of prospect.painPoints) {
      if (Array.isArray(painPoint.evidencePosts)) {
        count += painPoint.evidencePosts.length;
      }
    }
  }

  if (Array.isArray(prospect.finance?.evidencePosts)) {
    count += prospect.finance.evidencePosts.length;
  }

  return count;
}

function applyProspectAnalyticsPatch(
  prospect: ProspectAnalyticsState,
  patch: ProspectAnalyticsPatch
): ProspectAnalyticsState {
  const next: ProspectAnalyticsState = { ...prospect };
  const mutableNext = next as Record<string, unknown>;

  for (const field of READY_INPUT_FIELDS) {
    if (hasOwnProperty(patch, field)) {
      mutableNext[field] = patch[field];
    }
  }

  return next;
}

function patchTouchesReadyInputs(patch: ProspectAnalyticsPatch) {
  return READY_INPUT_FIELDS.some((field) => hasOwnProperty(patch, field));
}

function inferReadyTransitionTimestamp(args: {
  patch: ProspectAnalyticsPatch;
  nextState: ProspectAnalyticsState;
  now: number;
}) {
  if (
    hasOwnProperty(args.patch, "readyAt") &&
    typeof args.nextState.readyAt === "number"
  ) {
    return args.nextState.readyAt;
  }

  if (
    hasOwnProperty(args.patch, "enrichedAt") &&
    typeof args.nextState.enrichedAt === "number"
  ) {
    return Math.max(
      args.nextState.enrichedAt,
      args.nextState.qualifiedAt ?? args.nextState.enrichedAt
    );
  }

  if (
    hasOwnProperty(args.patch, "qualifiedAt") &&
    typeof args.nextState.qualifiedAt === "number"
  ) {
    return Math.max(
      args.nextState.qualifiedAt,
      args.nextState.enrichedAt ?? args.nextState.qualifiedAt
    );
  }

  if (
    hasOwnProperty(args.patch, "qualificationStatus") ||
    hasOwnProperty(args.patch, "enrichmentStatus") ||
    hasOwnProperty(args.patch, "evidencePosts") ||
    hasOwnProperty(args.patch, "painPoints") ||
    hasOwnProperty(args.patch, "finance")
  ) {
    return args.now;
  }

  return inferProspectReadyAtFromState(args.nextState) ?? args.now;
}

export function classifyQualificationActivityTitle(
  title: string
): "qualified" | "disqualified" | null {
  if (title.startsWith("Qualified with") || title.startsWith("Good match ·")) {
    return "qualified";
  }

  if (
    title.startsWith("Did not qualify") ||
    title.startsWith("Not a match ·")
  ) {
    return "disqualified";
  }

  return null;
}

export function isProspectReadyQualifiedEnriched(
  prospect: Pick<Doc<"prospects">, "qualificationStatus" | "enrichmentStatus">
): boolean {
  return (
    prospect.qualificationStatus === "qualified" &&
    (prospect.enrichmentStatus === "enriched" ||
      prospect.enrichmentStatus === "partial")
  );
}

export function isProspectActionableReady(
  prospect: Pick<
    Doc<"prospects">,
    | "platform"
    | "qualificationStatus"
    | "enrichmentStatus"
    | "evidencePosts"
    | "painPoints"
    | "finance"
  >
): boolean {
  if (!isProspectReadyQualifiedEnriched(prospect)) {
    return false;
  }

  if (prospect.platform !== "linkedin") {
    return true;
  }

  return countProspectEvidencePosts(prospect) > 0;
}

export function inferProspectReadyAtFromState(
  prospect: ProspectAnalyticsState
): number | undefined {
  if (!isProspectActionableReady(prospect)) {
    return undefined;
  }

  const timestamps = [
    prospect.readyAt,
    prospect.enrichedAt,
    prospect.qualifiedAt,
  ].filter((value): value is number => typeof value === "number");

  if (timestamps.length === 0) {
    return undefined;
  }

  return Math.max(...timestamps);
}

export function buildProspectAnalyticsTransitionPatch(args: {
  prospect: ProspectAnalyticsState;
  patch: ProspectAnalyticsPatch;
  now: number;
}): ProspectAnalyticsPatch {
  const { prospect, patch, now } = args;
  const derivedPatch: ProspectAnalyticsPatch = {};

  if (
    hasOwnProperty(patch, "qualificationStatus") ||
    hasOwnProperty(patch, "qualifiedAt") ||
    hasOwnProperty(patch, "disqualifiedAt")
  ) {
    const nextState = applyProspectAnalyticsPatch(prospect, patch);

    if (nextState.qualificationStatus === "qualified") {
      if (
        !hasOwnProperty(patch, "qualifiedAt") &&
        prospect.qualificationStatus !== "qualified"
      ) {
        derivedPatch.qualifiedAt = prospect.qualifiedAt ?? now;
      }

      if (
        prospect.disqualifiedAt !== undefined ||
        hasOwnProperty(patch, "disqualifiedAt")
      ) {
        derivedPatch.disqualifiedAt = undefined;
      }
    } else if (nextState.qualificationStatus === "disqualified") {
      if (
        !hasOwnProperty(patch, "disqualifiedAt") &&
        prospect.qualificationStatus !== "disqualified"
      ) {
        derivedPatch.disqualifiedAt = now;
      }

      if (
        prospect.qualifiedAt !== undefined ||
        hasOwnProperty(patch, "qualifiedAt")
      ) {
        derivedPatch.qualifiedAt = undefined;
      }
    } else if (nextState.qualificationStatus === "pending") {
      if (
        prospect.qualifiedAt !== undefined ||
        hasOwnProperty(patch, "qualifiedAt")
      ) {
        derivedPatch.qualifiedAt = undefined;
      }

      if (
        prospect.disqualifiedAt !== undefined ||
        hasOwnProperty(patch, "disqualifiedAt")
      ) {
        derivedPatch.disqualifiedAt = undefined;
      }
    }
  }

  if (
    !patchTouchesReadyInputs(patch) &&
    !patchTouchesReadyInputs(derivedPatch)
  ) {
    return derivedPatch;
  }

  const nextState = applyProspectAnalyticsPatch(prospect, {
    ...patch,
    ...derivedPatch,
  });
  const previousReady = isProspectActionableReady(prospect);
  const nextReady = isProspectActionableReady(nextState);

  if (!nextReady) {
    if (prospect.readyAt !== undefined || hasOwnProperty(patch, "readyAt")) {
      derivedPatch.readyAt = undefined;
    }
    return derivedPatch;
  }

  if (hasOwnProperty(patch, "readyAt")) {
    derivedPatch.readyAt = nextState.readyAt;
    return derivedPatch;
  }

  if (previousReady && prospect.readyAt !== undefined) {
    return derivedPatch;
  }

  derivedPatch.readyAt = previousReady
    ? inferProspectReadyAtFromState(nextState)
    : inferReadyTransitionTimestamp({
        patch,
        nextState,
        now,
      });

  return derivedPatch;
}

export function buildProspectAnalyticsBackfillPatch(args: {
  prospect: ProspectAnalyticsState;
  qualificationActivity?: ProspectQualificationActivitySnapshot;
}): ProspectAnalyticsPatch | null {
  const { prospect, qualificationActivity } = args;
  const derivedPatch: ProspectAnalyticsPatch = {};

  if (prospect.qualificationStatus === "qualified") {
    const nextQualifiedAt =
      prospect.qualifiedAt ?? qualificationActivity?.latestQualifiedAt;
    if (nextQualifiedAt !== prospect.qualifiedAt) {
      derivedPatch.qualifiedAt = nextQualifiedAt;
    }
    if (prospect.disqualifiedAt !== undefined) {
      derivedPatch.disqualifiedAt = undefined;
    }
  } else if (prospect.qualificationStatus === "disqualified") {
    const nextDisqualifiedAt =
      prospect.disqualifiedAt ?? qualificationActivity?.latestDisqualifiedAt;
    if (nextDisqualifiedAt !== prospect.disqualifiedAt) {
      derivedPatch.disqualifiedAt = nextDisqualifiedAt;
    }
    if (prospect.qualifiedAt !== undefined) {
      derivedPatch.qualifiedAt = undefined;
    }
  } else {
    if (prospect.qualifiedAt !== undefined) {
      derivedPatch.qualifiedAt = undefined;
    }
    if (prospect.disqualifiedAt !== undefined) {
      derivedPatch.disqualifiedAt = undefined;
    }
  }

  const nextState = applyProspectAnalyticsPatch(prospect, derivedPatch);
  const inferredReadyAt = inferProspectReadyAtFromState(nextState);

  if (inferredReadyAt !== nextState.readyAt) {
    derivedPatch.readyAt = inferredReadyAt;
  }

  return Object.keys(derivedPatch).length > 0 ? derivedPatch : null;
}
