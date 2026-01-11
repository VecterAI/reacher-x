// convex/agents/outreach/rag.ts
// RAG instance for prospect context semantic search
// Uses OpenRouter for embeddings via the AI SDK

import { RAG } from "@convex-dev/rag";
import { components } from "../../_generated/api";
import { openrouter } from "@openrouter/ai-sdk-provider";

/**
 * Content types that can be indexed for prospect context:
 * - evidence_post: Posts used to qualify the prospect
 * - pain_point: Identified pain points from evidence
 * - profile: Profile information and brief intro
 */
type ProspectRagFilters = {
  contentType: "evidence_post" | "pain_point" | "profile";
};

/**
 * RAG instance for prospect context.
 *
 * Namespacing pattern: `prospect:{prospectId}`
 * This allows per-prospect isolated search.
 *
 * Usage:
 * - Add evidence posts during qualification
 * - Add pain points during enrichment
 * - Search during plan generation
 */
export const prospectRag = new RAG<ProspectRagFilters>(components.rag, {
  // OpenRouter embedding model via AI SDK
  // Using text-embedding-3-small for good balance of quality and cost
  textEmbeddingModel: openrouter.textEmbeddingModel(
    "openai/text-embedding-3-small"
  ),
  embeddingDimension: 1536,
  filterNames: ["contentType"],
});

/**
 * Helper to generate namespace for a prospect
 */
export function getProspectNamespace(prospectId: string): string {
  return `prospect:${prospectId}`;
}
