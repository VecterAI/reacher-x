import type { Doc } from "../_generated/dataModel";
import { getStringProperty, isRecord } from "./typeGuards";

type PostedOutreachTask = Pick<Doc<"outreachTasks">, "type">;

/**
 * Returns the provider artifact that proves an outreach write succeeded.
 * LinkedIn comments use comment IDs, X replies use tweet IDs, and DMs use
 * either their message or conversation ID.
 */
export function getPostedOutreachArtifactId(
  task: PostedOutreachTask,
  resultData: unknown
): string | null {
  if (!isRecord(resultData)) {
    return null;
  }

  if (task.type === "comment") {
    return (
      getStringProperty(resultData, "commentId") ??
      getStringProperty(resultData, "messageId") ??
      getStringProperty(resultData, "postedTweetId") ??
      null
    );
  }

  if (task.type === "dm") {
    return (
      getStringProperty(resultData, "messageId") ??
      getStringProperty(resultData, "conversationId") ??
      null
    );
  }

  if (task.type === "react") {
    return getStringProperty(resultData, "reactionTargetId") ?? null;
  }

  return null;
}

export function hasRequiredPostedOutreachArtifact(
  task: PostedOutreachTask,
  resultData: unknown
): boolean {
  if (task.type !== "comment" && task.type !== "dm" && task.type !== "react") {
    return true;
  }
  return getPostedOutreachArtifactId(task, resultData) !== null;
}
