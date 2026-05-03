// convex/agents/outreach/rag.ts
// RAG instance for prospect context semantic search
// Uses OpenRouter for embeddings via the AI SDK

import { RAG } from "@convex-dev/rag";
import { components } from "../../_generated/api";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
    | "workspace_prospect_summary"
    /** List UI unified search (namespace `prospect_search`). */
    | "prospect_search_list";
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

function getRagEmbeddingModel() {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    return createOpenRouter({
      apiKey: openRouterApiKey,
      headers: {
        "HTTP-Referer": "https://reacherx.com",
        "X-Title": "ReacherX",
      },
    }).textEmbeddingModel("openai/text-embedding-3-small");
  }

  if (process.env.OPENAI_API_KEY) {
    return openai.embedding("text-embedding-3-small");
  }

  throw new Error(
    "[RAG] Missing OPENROUTER_API_KEY and OPENAI_API_KEY environment variables."
  );
}

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
  // Keep embeddings on the same provider stack as the rest of the app.
  // OpenRouter is primary to avoid a separate OpenAI billing dependency.
  textEmbeddingModel: getRagEmbeddingModel() as any,
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
