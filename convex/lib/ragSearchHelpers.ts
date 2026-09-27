import { logger } from "../../shared/lib/logger";

export const ragSearchCallers = [
  "discovery_semantic_duplicate_screening",
  "prospect_search_unified",
  "shared_workspace_memory_context",
  "workspace_memory_namespace_search",
] as const;

export type RagSearchCaller = (typeof ragSearchCallers)[number];

const ragSearchLogger = logger.withScope("RagSearch");

/**
 * Emits one structured log line per RAG vector search (including cache hits)
 * so per-caller usage can be counted from logs and attributed on Convex
 * invoices.
 */
export function logRagSearch(args: {
  caller: RagSearchCaller;
  workspaceId: string;
  namespace: string;
  limit: number;
  resultCount: number;
  durationMs: number;
  outcome: "success" | "error" | "cache_hit";
}) {
  ragSearchLogger.info("RAG vector search", args);
}
