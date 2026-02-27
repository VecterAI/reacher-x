export type AgentPanelMode = "approval" | "posted";

export interface InlinePanelOpenPayload {
  platform: "twitter" | "linkedin";
  postData: unknown;
  context?: string;
  taskId?: string;
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
  postData: unknown
): string | undefined {
  if (!postData || typeof postData !== "object") return undefined;
  const record = postData as Record<string, unknown>;
  if (typeof record.id_str === "string") return record.id_str;
  if (typeof record.id === "string") return record.id;
  if (typeof record.id === "number") return String(record.id);
  return undefined;
}
