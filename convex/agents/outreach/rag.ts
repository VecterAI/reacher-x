// convex/agents/outreach/rag.ts
// RAG instance for prospect context semantic search
// Uses the shared AI SDK embedding model for vector search

import { RAG } from "@convex-dev/rag";
import { components } from "../../_generated/api";
import {
  getWorkspaceMemoryNamespace,
  type WorkspaceMemoryNamespaceKind,
} from "../../lib/memoryHelpers";
import { getTextEmbeddingModel } from "../../lib/embeddingModels";

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
    | "workspace_prospect_summary"
    /** List UI unified search (namespace `prospect_search`). */
    | "prospect_search_list";
};

/**
 * Metadata stored alongside RAG entries for auditability.
 */
type AgentMemoryEntryMetadata = {
  targetingFingerprint?: string;
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
type AgentMemoryRag = RAG<AgentMemoryRagFilters, AgentMemoryEntryMetadata>;

let agentMemoryRag: AgentMemoryRag | undefined;

/**
 * Lazily creates the shared RAG client.
 *
 * Importing a module that can schedule memory indexing must not require an
 * embedding provider. The provider is only needed when an action actually
 * performs a RAG operation.
 */
export function getAgentMemoryRag(): AgentMemoryRag {
  agentMemoryRag ??= new RAG<AgentMemoryRagFilters, AgentMemoryEntryMetadata>(
    components.rag,
    {
      textEmbeddingModel: getTextEmbeddingModel() as any,
      embeddingDimension: 1536,
      filterNames: ["contentType"],
    }
  );
  return agentMemoryRag;
}

/**
 * Backwards-compatible alias used by the existing outreach/prospect RAG code.
 */
export const getProspectRag = getAgentMemoryRag;

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
