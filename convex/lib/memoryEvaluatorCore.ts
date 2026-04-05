import type { Doc } from "../_generated/dataModel";
import { createStableHash, normalizeMemoryText } from "./memoryHelpers";

export const MEMORY_EVALUATOR_PROMPT_VERSION = "memory-evaluator-v1";
export const AUTO_PROMOTE_MEMORY_CONFIDENCE = 0.78;

export const EVALUATOR_RELEVANT_EVENT_TYPES = [
  "qualification_completed",
  "enrichment_completed",
  "outreach_plan_approved",
  "outreach_plan_abandoned",
  "outreach_task_approved",
  "outreach_task_completed",
  "outreach_task_failed",
  "prospect_responded",
  "prospect_archived",
  "prospect_converted",
  "style_backfill_completed",
  "style_tweets_batch_ready",
  "style_edit_diff_captured",
] as const satisfies ReadonlyArray<Doc<"memoryWorkflowEvents">["eventType"]>;

type MemoryWorkflowEventType = Doc<"memoryWorkflowEvents">["eventType"];
type MemoryWorkflowEventStatus = Doc<"memoryWorkflowEvents">["status"];

const RELEVANT_EVENT_TYPES = new Set<MemoryWorkflowEventType>(
  EVALUATOR_RELEVANT_EVENT_TYPES
);

export function isEvaluatorRelevantEventType(
  eventType: MemoryWorkflowEventType
) {
  return RELEVANT_EVENT_TYPES.has(eventType);
}

export function resolveDefaultMemoryWorkflowEventStatus(args: {
  eventType: MemoryWorkflowEventType;
  explicitStatus?: MemoryWorkflowEventStatus;
}): MemoryWorkflowEventStatus {
  if (args.explicitStatus) {
    return args.explicitStatus;
  }

  return isEvaluatorRelevantEventType(args.eventType) ? "pending" : "ignored";
}

export function shouldAutoPromoteMemory(args: {
  confidence: number;
  impactScore?: number;
}) {
  const impactScore = args.impactScore ?? 0;
  return (
    args.confidence >= AUTO_PROMOTE_MEMORY_CONFIDENCE ||
    (args.confidence >= 0.72 && impactScore >= 0.85)
  );
}

export function buildMemorySuggestionIdentityHash(args: {
  workspaceId: string;
  eventKey?: string;
  category: string;
  title: string;
  summary: string;
}) {
  return createStableHash(
    JSON.stringify({
      workspaceId: args.workspaceId,
      eventKey: args.eventKey ?? null,
      category: args.category,
      title: normalizeMemoryText(args.title),
      summary: normalizeMemoryText(args.summary),
    })
  );
}
