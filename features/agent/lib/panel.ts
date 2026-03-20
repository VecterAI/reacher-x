import {
  getTwitterPostId,
  type TwitterPostRef,
  type TwitterPostSummary,
} from "@/shared/lib/twitter/contracts";

export type AgentPanelMode = "approval" | "posted";

export interface InlinePanelOpenPayload {
  platform: "twitter" | "linkedin";
  postData?: unknown;
  postRef?: TwitterPostRef;
  postSummary?: TwitterPostSummary;
  context?: string;
  taskId?: string;
  actionRequestId?: string;
  taskStatus?: string;
  panelMode?: AgentPanelMode;
  targetTweetId?: string;
}

export function getPanelModeFromTaskStatus(
  status?: string
): AgentPanelMode | undefined {
  if (!status) return undefined;
  if (
    status === "pending" ||
    status === "executing" ||
    status === "scheduled"
  ) {
    return "approval";
  }
  if (status === "waiting_response" || status === "completed") {
    return "posted";
  }
  return undefined;
}

export function getTweetIdFromPostPayload(
  payload: Pick<InlinePanelOpenPayload, "postData" | "postRef" | "postSummary">
): string | undefined {
  return (
    payload.postRef?.postId ??
    getTwitterPostId(payload.postSummary ?? payload.postData)
  );
}
