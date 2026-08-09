import type { Doc } from "@/convex/_generated/dataModel";

export type ProspectOutreachProgress = NonNullable<
  Doc<"prospectSummaries">["outreachProgress"]
>;

/** Visual group for the prospect-card outreach badge. */
export type OutreachProgressIndicator =
  | "spinner" // Active — braille spinner
  | "waiting" // Waiting — CalendarClockIcon
  | "attention" // Needs you — WarningIcon
  | "paused" // Paused — PauseCircleIcon
  | "blocked" // Blocked — ErrorIcon
  | "success"; // Done — CheckIcon

export type OutreachProgressTone =
  | "active"
  | "attention"
  | "warning"
  | "success"
  | "muted";

export interface OutreachProgressPresentation {
  label: string;
  title: string;
  indicator: OutreachProgressIndicator;
  tone: OutreachProgressTone;
}

type PlanGenerationStatus = Doc<"prospects">["planGenerationStatus"];
type OutreachProgressActiveTask = NonNullable<
  ProspectOutreachProgress["activeTask"]
>;

const TASK_TYPE_FALLBACK_LABELS: Record<
  OutreachProgressActiveTask["type"],
  string
> = {
  comment: "Post a comment",
  dm: "Send a DM",
  react: "React to a post",
  wait: "Wait",
  ask_human: "Get your input",
};

function formatProgress(
  progress: Pick<
    ProspectOutreachProgress,
    "finishedTaskCount" | "totalTaskCount"
  >
) {
  return progress.totalTaskCount > 0
    ? `${progress.finishedTaskCount}/${progress.totalTaskCount}`
    : null;
}

function getActiveTaskDescription(activeTask: OutreachProgressActiveTask) {
  return (
    activeTask.description.trim().replaceAll(/\s+/g, " ") ||
    TASK_TYPE_FALLBACK_LABELS[activeTask.type]
  );
}

function getActiveStepLabel(progress: ProspectOutreachProgress) {
  const activeTask = progress.activeTask;
  if (!activeTask) {
    return "Executing plan";
  }

  return `Step ${activeTask.order}/${progress.totalTaskCount} · ${getActiveTaskDescription(activeTask)}`;
}

export function resolveOutreachProgressPresentation({
  planGenerationStatus,
  progress,
}: {
  planGenerationStatus?: PlanGenerationStatus;
  progress?: ProspectOutreachProgress;
}): OutreachProgressPresentation | null {
  if (!progress) {
    return planGenerationStatus === "generating"
      ? {
          label: "Creating plan",
          title: "The agent is creating an outreach plan",
          indicator: "spinner",
          tone: "active",
        }
      : null;
  }

  const progressText = formatProgress(progress);
  const withProgress = (label: string) =>
    progressText ? `${label} · ${progressText}` : label;

  switch (progress.planStatus) {
    case "draft":
      return {
        label: withProgress("Review plan"),
        title: "The outreach plan is ready for review",
        indicator: "attention",
        tone: "attention",
      };
    case "approved":
      return {
        label: withProgress("Plan ready"),
        title: "The outreach plan is approved and ready to start",
        indicator: "waiting",
        tone: "muted",
      };
    case "paused":
      if (progress.activeTask?.status === "waiting_manual") {
        return {
          label: withProgress("Manual reply needed"),
          title:
            "Post the prepared reply on X; ReacherX is watching automatically",
          indicator: "attention",
          tone: "attention",
        };
      }
      if (progress.activeTask?.status === "waiting_connection") {
        return {
          label: withProgress("Connection requested"),
          title:
            "ReacherX will send the approved DM automatically after acceptance",
          indicator: "waiting",
          tone: "muted",
        };
      }
      return {
        label: withProgress("Paused"),
        title: "Outreach execution is paused",
        indicator: "paused",
        tone: "attention",
      };
    case "blocked_auth":
      return {
        label: withProgress("Reconnect required"),
        title: "Reconnect the social account to continue outreach",
        indicator: "blocked",
        tone: "warning",
      };
    case "completed":
      return {
        label: withProgress("Complete"),
        title: "The outreach plan is complete",
        indicator: "success",
        tone: "success",
      };
    case "abandoned":
      return null;
    case "executing": {
      const activeTask = progress.activeTask;
      if (!activeTask) {
        return {
          label: withProgress("Executing plan"),
          title: "The agent is executing the outreach plan",
          indicator: "spinner",
          tone: "active",
        };
      }

      const description = getActiveTaskDescription(activeTask);
      if (activeTask.awaitingApproval) {
        return {
          label: `Review step ${activeTask.order}/${progress.totalTaskCount} · ${description}`,
          title: `Your approval is needed: ${description}`,
          indicator: "attention",
          tone: "attention",
        };
      }
      if (activeTask.status === "waiting_response") {
        return {
          label: withProgress("Posted · Waiting for reply"),
          title: description,
          indicator: "waiting",
          tone: "muted",
        };
      }
      if (activeTask.status === "failed") {
        return {
          label: `Step ${activeTask.order}/${progress.totalTaskCount} failed`,
          title: description,
          indicator: "blocked",
          tone: "warning",
        };
      }
      if (activeTask.status === "scheduled" || activeTask.type === "wait") {
        return {
          label: getActiveStepLabel(progress),
          title: description,
          indicator: "waiting",
          tone: "muted",
        };
      }
      if (activeTask.type === "ask_human") {
        return {
          label: `Needs input · ${activeTask.order}/${progress.totalTaskCount}`,
          title: description,
          indicator: "attention",
          tone: "attention",
        };
      }

      return {
        label: getActiveStepLabel(progress),
        title: description,
        indicator: "spinner",
        tone: "active",
      };
    }
  }
}
