// convex/agents/outreach/rag.ts
// RAG instance for prospect context semantic search
// Uses OpenRouter for embeddings via the AI SDK

import { RAG } from "@convex-dev/rag";
import { components } from "../../_generated/api";
import { openrouter } from "@openrouter/ai-sdk-provider";
import {
  getWorkspaceMemoryNamespace,
  type WorkspaceMemoryNamespaceKind,
} from "../../lib/memoryHelpers";

/**
 * Content types that can be indexed for prospect context:
 * - evidence_post: Posts used to qualify the prospect
 * - pain_point: Identified pain points from evidence
 * - profile: Profile information and brief intro
 */
type AgentMemoryRagFilters = {
  contentType:
    | "evidence_post"
    | "pain_point"
    | "profile"
    | "query_candidate"
    | "workspace_memory"
    | "workspace_prospect_summary";
};

/**
 * Metadata stored alongside RAG entries for auditability.
 */
type AgentMemoryEntryMetadata = {
  workspaceId?: string;
  prospectId?: string;
  memoryItemId?: string;
  queryCandidateId?: string;
  canonicalKey?: string;
  source?: string;
  type?: string;
  category?: string;
  namespace?: string;
  summaryType?: string;
};

/**
 * Shared RAG instance for prospect-local context and workspace-level memory.
 *
 * Namespacing pattern: `prospect:{prospectId}`
 * Workspace memory namespaces follow: `workspace:{workspaceId}:{kind}`
 *
 * Usage:
 * - Add evidence posts during qualification
 * - Add pain points during enrichment
 * - Add workspace memory items and query candidates during Phase 1+
 * - Search during plan generation
 */
export const agentMemoryRag = new RAG<
  AgentMemoryRagFilters,
  AgentMemoryEntryMetadata
>(components.rag, {
  // OpenRouter embedding model via AI SDK
  // Using text-embedding-3-small for good balance of quality and cost
  textEmbeddingModel: openrouter.textEmbeddingModel(
    "openai/text-embedding-3-small"
  ),
  embeddingDimension: 1536,
  filterNames: ["contentType"],
});

/**
 * Backwards-compatible alias used by the existing outreach/prospect RAG code.
 */
export const prospectRag = agentMemoryRag;

/**
 * Helper to generate namespace for a prospect
 */
export function getProspectNamespace(prospectId: string): string {
  return `prospect:${prospectId}`;
}

/**
 * Helper to generate a workspace-level semantic memory namespace.
 */
export function getWorkspaceNamespace(
  workspaceId: string,
  kind: WorkspaceMemoryNamespaceKind
): string {
  return getWorkspaceMemoryNamespace(workspaceId, kind);
}
