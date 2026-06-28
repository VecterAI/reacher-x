type ProspectDisplayTimestampStage =
  | "new"
  | "contacted"
  | "in_progress"
  | "converted"
  | "archived";

export interface ProspectDisplayTimestampSource {
  status?: ProspectDisplayTimestampStage;
  pipelineStage?: ProspectDisplayTimestampStage;
  stageTimestamps?: Partial<Record<ProspectDisplayTimestampStage, number>>;
  readyAt?: number;
  qualifiedAt?: number;
  prospectCreatedAt?: number;
  createdAt?: number;
  _creationTime?: number;
}

function asTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getCreatedAtTimestamp(
  prospect: ProspectDisplayTimestampSource
): number | undefined {
  return (
    asTimestamp(prospect.prospectCreatedAt) ??
    asTimestamp(prospect.createdAt) ??
    asTimestamp(prospect._creationTime) ??
    asTimestamp(prospect.stageTimestamps?.new)
  );
}

function getActiveStage(
  prospect: ProspectDisplayTimestampSource
): ProspectDisplayTimestampStage | undefined {
  return prospect.status ?? prospect.pipelineStage;
}

/**
 * Resolve the primary timestamp shown beside a prospect name.
 * This intentionally avoids updatedAt because background merges/backfills can
 * touch a record without changing when the prospect actually entered a user
 * visible stage.
 */
export function getProspectDisplayTimestamp(
  prospect: ProspectDisplayTimestampSource
): number | undefined {
  const createdAt = getCreatedAtTimestamp(prospect);
  const readyAt = asTimestamp(prospect.readyAt);
  const qualifiedAt = asTimestamp(prospect.qualifiedAt);
  const activeStage = getActiveStage(prospect);

  if (
    activeStage === "contacted" ||
    activeStage === "in_progress" ||
    activeStage === "converted"
  ) {
    return (
      asTimestamp(prospect.stageTimestamps?.[activeStage]) ??
      readyAt ??
      qualifiedAt ??
      createdAt
    );
  }

  return readyAt ?? qualifiedAt ?? createdAt;
}
