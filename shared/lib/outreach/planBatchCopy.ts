export type PlanBatchCopyOperation = "create" | "update" | "create_or_update";

export type PlanBatchCopyStatus =
  | "selecting"
  | "awaiting_confirmation"
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export interface PlanBatchCopyState {
  operation: PlanBatchCopyOperation;
  scopeKind: "tagged" | "plan_group" | "named" | "all" | "fit_score";
  status: PlanBatchCopyStatus;
  targetCount: number;
  eligibleCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  createdCount: number;
  updatedCount: number;
  targetNames?: string[];
  fitScoreMin?: number;
  fitScoreMax?: number;
}

export interface PlanBatchCopy {
  title: string;
  status: string;
}

const countFormatter = new Intl.NumberFormat("en-US");

function formatCount(count: number) {
  return countFormatter.format(Math.max(0, count));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function getSmallTargetNames(state: PlanBatchCopyState): string[] {
  if (
    state.eligibleCount < 1 ||
    state.eligibleCount > 2 ||
    state.targetNames?.length !== state.eligibleCount
  ) {
    return [];
  }

  return state.targetNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function formatNames(names: string[]) {
  return names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
}

function getActionTitle(state: PlanBatchCopyState) {
  const names = getSmallTargetNames(state);
  const namedTargets = formatNames(names);

  if (state.operation === "create") {
    if (names.length === 1) {
      return `Creating an outreach plan for ${namedTargets}`;
    }
    if (names.length === 2) {
      return `Creating outreach plans for ${namedTargets}`;
    }
    return `Creating ${formatCount(state.eligibleCount)} outreach plans`;
  }

  if (state.operation === "update") {
    if (names.length === 1) {
      return `Updating the outreach plan for ${namedTargets}`;
    }
    if (names.length === 2) {
      return `Updating outreach plans for ${namedTargets}`;
    }
    return `Updating ${formatCount(state.eligibleCount)} outreach plans`;
  }

  if (names.length === 1) {
    return `Working on an outreach plan for ${namedTargets}`;
  }
  if (names.length === 2) {
    return `Working on outreach plans for ${namedTargets}`;
  }
  return `Working on ${formatCount(state.eligibleCount)} outreach plans`;
}

function getReadyTitle(state: PlanBatchCopyState) {
  const names = getSmallTargetNames(state);
  const namedTargets = formatNames(names);

  if (names.length === 1) {
    return `The outreach plan for ${namedTargets} is ready`;
  }
  if (names.length === 2) {
    return `Outreach plans for ${namedTargets} are ready`;
  }
  return `${formatCount(state.succeededCount)} outreach ${pluralize(
    state.succeededCount,
    "plan"
  )} ${state.succeededCount === 1 ? "is" : "are"} ready`;
}

function getOperationResultParts(state: PlanBatchCopyState) {
  const parts: string[] = [];

  if (state.createdCount > 0) {
    parts.push(
      `${formatCount(state.createdCount)} ${pluralize(
        state.createdCount,
        "plan"
      )} created`
    );
  }
  if (state.updatedCount > 0) {
    parts.push(
      `${formatCount(state.updatedCount)} ${pluralize(
        state.updatedCount,
        "plan"
      )} updated`
    );
  }
  if (parts.length === 0 && state.succeededCount > 0) {
    parts.push("Ready to review");
  }

  return parts;
}

function getNotChangedText(operation: PlanBatchCopyOperation, count: number) {
  const formattedCount = formatCount(count);
  const planWord = pluralize(count, "plan");

  if (operation === "create") {
    return `${formattedCount} ${planWord} ${count === 1 ? "was" : "were"} not created`;
  }
  if (operation === "update") {
    return `${formattedCount} ${planWord} ${count === 1 ? "was" : "were"} not updated`;
  }
  return `${formattedCount} ${planWord} ${count === 1 ? "was" : "were"} not changed`;
}

function getSelectionStatus(state: PlanBatchCopyState) {
  if (
    state.scopeKind === "fit_score" &&
    typeof state.fitScoreMin === "number" &&
    typeof state.fitScoreMax === "number"
  ) {
    return `Finding people with match scores from ${state.fitScoreMin} to ${state.fitScoreMax}`;
  }
  return state.scopeKind === "all"
    ? "Checking all people"
    : state.scopeKind === "fit_score"
      ? "Checking matching people"
      : "Checking selected people";
}

function getConfirmationStatus(state: PlanBatchCopyState) {
  const action =
    state.operation === "create"
      ? "creating plans"
      : state.operation === "update"
        ? "updating plans"
        : "working on the plans";
  const parts = [`Reply yes to start ${action}`];

  if (state.skippedCount > 0) {
    parts.push(
      `${formatCount(state.skippedCount)} ${pluralize(
        state.skippedCount,
        "person",
        "people"
      )} cannot be included`
    );
  }

  return parts.join(". ");
}

function getStoppedTitle(operation: PlanBatchCopyOperation) {
  if (operation === "create") {
    return "Creating outreach plans stopped";
  }
  if (operation === "update") {
    return "Updating outreach plans stopped";
  }
  return "Work on the outreach plans stopped";
}

function getFailedTitle(operation: PlanBatchCopyOperation) {
  if (operation === "create") {
    return "We could not create the outreach plans";
  }
  if (operation === "update") {
    return "We could not update the outreach plans";
  }
  return "We could not finish the outreach plans";
}

export function getPlanBatchCopy(state: PlanBatchCopyState): PlanBatchCopy {
  switch (state.status) {
    case "selecting":
      return {
        title: "Checking people",
        status: getSelectionStatus(state),
      };
    case "awaiting_confirmation":
      return {
        title: `${formatCount(state.eligibleCount)} ${pluralize(
          state.eligibleCount,
          "person",
          "people"
        )} ${state.eligibleCount === 1 ? "is" : "are"} ready`,
        status: getConfirmationStatus(state),
      };
    case "queued":
    case "running":
      return {
        title: getActionTitle(state),
        status: `${formatCount(state.succeededCount)} of ${formatCount(
          state.eligibleCount
        )} ${pluralize(state.eligibleCount, "plan")} ready`,
      };
    case "completed": {
      if (state.succeededCount === 0) {
        return {
          title:
            state.operation === "create"
              ? "No outreach plans were created"
              : state.operation === "update"
                ? "No outreach plans were updated"
                : "No outreach plans were changed",
          status:
            state.skippedCount > 0
              ? getNotChangedText(state.operation, state.skippedCount)
              : "No plans needed changes",
        };
      }

      const parts = getOperationResultParts(state);
      if (state.skippedCount > 0) {
        parts.push(getNotChangedText(state.operation, state.skippedCount));
      }
      return {
        title: getReadyTitle(state),
        status: parts.join(". "),
      };
    }
    case "partial": {
      const parts = [
        `${formatCount(state.failedCount)} ${pluralize(
          state.failedCount,
          "plan"
        )} ${state.failedCount === 1 ? "needs" : "need"} attention`,
      ];
      if (state.skippedCount > 0) {
        parts.push(getNotChangedText(state.operation, state.skippedCount));
      }
      return {
        title: `${formatCount(state.succeededCount)} of ${formatCount(
          state.eligibleCount
        )} outreach ${pluralize(state.eligibleCount, "plan")} ${
          state.succeededCount === 1 ? "is" : "are"
        } ready`,
        status: parts.join(". "),
      };
    }
    case "failed":
      return {
        title: getFailedTitle(state.operation),
        status: "No plans were changed",
      };
    case "cancelled":
      return {
        title: getStoppedTitle(state.operation),
        status:
          state.succeededCount > 0
            ? `${formatCount(state.succeededCount)} ${pluralize(
                state.succeededCount,
                "plan"
              )} ready. The rest were stopped`
            : "No plans were changed",
      };
  }
}

export interface PlanBatchTitleValue {
  text: string;
  kind: "count" | "name";
}

export function getPlanBatchTitleValues(
  state: PlanBatchCopyState
): PlanBatchTitleValue[] {
  switch (state.status) {
    case "awaiting_confirmation":
      return [{ text: formatCount(state.eligibleCount), kind: "count" }];
    case "queued":
    case "running": {
      const names = getSmallTargetNames(state);
      return names.length > 0
        ? names.map((name) => ({ text: name, kind: "name" as const }))
        : [{ text: formatCount(state.eligibleCount), kind: "count" }];
    }
    case "completed": {
      if (state.succeededCount === 0) {
        return [];
      }
      const names = getSmallTargetNames(state);
      return names.length > 0
        ? names.map((name) => ({ text: name, kind: "name" as const }))
        : [{ text: formatCount(state.succeededCount), kind: "count" }];
    }
    case "partial":
      return [
        { text: formatCount(state.succeededCount), kind: "count" },
        { text: formatCount(state.eligibleCount), kind: "count" },
      ];
    case "selecting":
    case "failed":
    case "cancelled":
      return [];
  }
}

export function getPlanBatchStartedMessage(operation: PlanBatchCopyOperation) {
  if (operation === "create") {
    return "Started creating the selected outreach plans.";
  }
  if (operation === "update") {
    return "Started updating the selected outreach plans.";
  }
  return "Started working on the selected outreach plans.";
}

export function getPlanBatchNotificationCopy(
  state: PlanBatchCopyState
): PlanBatchCopy {
  const copy = getPlanBatchCopy(state);

  if (state.status === "queued" || state.status === "running") {
    return {
      title: copy.title,
      status: "We will let you know when the plans are ready.",
    };
  }

  if (state.status === "completed" && state.succeededCount > 0) {
    return {
      title: copy.title,
      status: "Open the chat when you want to review them.",
    };
  }

  return copy;
}
