import type { Id } from "../_generated/dataModel";

export const SETUP_PREVIEW_REVIEW_MODES = ["fallback", "qualified"] as const;

export type SetupPreviewReviewMode =
  (typeof SETUP_PREVIEW_REVIEW_MODES)[number];

export type SetupPreviewReviewSnapshot = {
  previewProspectIds: Id<"prospects">[];
  previewReviewMode: SetupPreviewReviewMode;
};

export type SetupPreviewWorkflowSemanticFailure = {
  retryable: boolean;
  errorCode: string;
  errorMessage: string;
};

export function resolveSetupPreviewWorkflowSemanticFailure(args: {
  status: string;
  reason?: string;
}): SetupPreviewWorkflowSemanticFailure | null {
  if (args.status !== "error") {
    return null;
  }

  switch (args.reason) {
    case "missing_synthetic_posts":
      return {
        retryable: true,
        errorCode: "preview_missing_targeting_signals",
        errorMessage:
          "Some ideal profiles are missing targeting data. Approve the profiles again to refresh them and retry the preview.",
      };
    case "workspace_setup_incomplete":
      return {
        retryable: true,
        errorCode: "preview_workspace_setup_incomplete",
        errorMessage:
          "The draft workspace is incomplete. Approve the ideal profiles again to repair it and retry the preview.",
      };
    case "workspace_missing":
      return {
        retryable: false,
        errorCode: "preview_workspace_missing",
        errorMessage:
          "The draft workspace used for this preview no longer exists. Start a new setup draft.",
      };
    default:
      return {
        retryable: false,
        errorCode: "preview_workflow_failed",
        errorMessage:
          "The setup preview stopped because of an unrecoverable workflow error.",
      };
  }
}

type ResolveSetupPreviewReviewSnapshotArgs = {
  currentPreviewProspectIds?: Id<"prospects">[];
  currentPreviewReviewMode?: SetupPreviewReviewMode;
  rankedQualifiedIds: Id<"prospects">[];
  rankedPreviewIds: Id<"prospects">[];
  limit: number;
};

function slicePreviewProspectIds(
  prospectIds: Id<"prospects">[],
  limit: number
): Id<"prospects">[] {
  return prospectIds.slice(0, limit);
}

function inferStoredPreviewReviewMode(args: {
  currentPreviewProspectIds: Id<"prospects">[];
  currentPreviewReviewMode?: SetupPreviewReviewMode;
  rankedQualifiedIds: Id<"prospects">[];
}): SetupPreviewReviewMode {
  if (args.currentPreviewReviewMode) {
    return args.currentPreviewReviewMode;
  }

  const rankedQualifiedIds = new Set(
    args.rankedQualifiedIds.map((prospectId) => String(prospectId))
  );

  return args.currentPreviewProspectIds.every((prospectId) =>
    rankedQualifiedIds.has(String(prospectId))
  )
    ? "qualified"
    : "fallback";
}

export function selectInitialSetupPreviewReviewSnapshot(args: {
  rankedQualifiedIds: Id<"prospects">[];
  rankedPreviewIds: Id<"prospects">[];
  limit: number;
}): SetupPreviewReviewSnapshot | null {
  if (args.rankedQualifiedIds.length > 0) {
    return {
      previewProspectIds: slicePreviewProspectIds(
        args.rankedQualifiedIds,
        args.limit
      ),
      previewReviewMode: "qualified",
    };
  }

  if (args.rankedPreviewIds.length > 0) {
    return {
      previewProspectIds: slicePreviewProspectIds(
        args.rankedPreviewIds,
        args.limit
      ),
      previewReviewMode: "fallback",
    };
  }

  return null;
}

export function resolveSetupPreviewReviewSnapshot(
  args: ResolveSetupPreviewReviewSnapshotArgs
): SetupPreviewReviewSnapshot | null {
  const currentPreviewProspectIds = slicePreviewProspectIds(
    args.currentPreviewProspectIds ?? [],
    args.limit
  );

  if (currentPreviewProspectIds.length === 0) {
    return selectInitialSetupPreviewReviewSnapshot({
      rankedQualifiedIds: args.rankedQualifiedIds,
      rankedPreviewIds: args.rankedPreviewIds,
      limit: args.limit,
    });
  }

  const currentPreviewReviewMode = inferStoredPreviewReviewMode({
    currentPreviewProspectIds,
    currentPreviewReviewMode: args.currentPreviewReviewMode,
    rankedQualifiedIds: args.rankedQualifiedIds,
  });

  if (
    currentPreviewReviewMode === "fallback" &&
    args.rankedQualifiedIds.length > 0
  ) {
    return {
      previewProspectIds: slicePreviewProspectIds(
        args.rankedQualifiedIds,
        args.limit
      ),
      previewReviewMode: "qualified",
    };
  }

  return {
    previewProspectIds: currentPreviewProspectIds,
    previewReviewMode: currentPreviewReviewMode,
  };
}

export function haveSamePreviewProspectIds(
  left: Id<"prospects">[],
  right: Id<"prospects">[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (String(left[index]) !== String(right[index])) {
      return false;
    }
  }

  return true;
}
