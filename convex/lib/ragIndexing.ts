"use node";

// convex/lib/ragIndexing.ts
// Helper functions for indexing prospect context to RAG
// Used by: workflows/qualification.ts, workflows/enrichment.ts

import { ActionCtx } from "../_generated/server";
import {
  agentMemoryRag,
  getProspectNamespace,
  getWorkspaceNamespace,
  prospectRag,
} from "../agents/outreach/rag";
import type { Doc } from "../_generated/dataModel";
import { EvidencePost } from "./enrichmentCore";
import { buildProspectSummaryRecord } from "./readModelHelpers";
import {
  buildContentHashFromText,
  buildQueryCandidateRagText,
  clampUnitInterval,
  getNamespaceKindForQueryCandidate,
} from "./memoryHelpers";

// ============================================================================
// Types
// ============================================================================

// Re-export EvidencePost for consumers that import from ragIndexing
export type { EvidencePost };

export interface PainPointForRag {
  pain: string;
  solution?: string;
  evidencePosts: EvidencePost[];
}

export interface QueryCandidateForRag {
  queryCandidateId: string;
  workspaceId: string;
  embeddingDocKey: string;
  canonicalKey: string;
  type: string;
  rawValue: string;
  canonicalValue: string;
  sourceTheme?: string;
  status: string;
  importance?: number;
}

export interface WorkspaceMemoryDocumentForRag {
  workspaceId: string;
  namespace: Parameters<typeof getWorkspaceNamespace>[1];
  key: string;
  title: string;
  text: string;
  importance?: number;
  prospectId?: string;
  memoryItemId?: string;
  category?: string;
  source?: string;
}

export interface WorkspaceProspectSummaryForRag {
  workspaceId: string;
  namespace: Parameters<typeof getWorkspaceNamespace>[1];
  prospectId: string;
  title: string;
  text: string;
  importance?: number;
}

// ============================================================================
// RAG Indexing Functions
// ============================================================================

/**
 * Index evidence posts from qualification to RAG.
 *
 * Called after qualification succeeds. Indexes the posts that
 * qualified this prospect so the agent can search for context.
 *
 * @param ctx - Action context
 * @param prospectId - Prospect ID for namespace
 * @param posts - Evidence posts to index
 */
export async function indexEvidencePosts(
  ctx: ActionCtx,
  prospectId: string,
  posts: EvidencePost[]
): Promise<{ indexed: number }> {
  if (posts.length === 0) {
    return { indexed: 0 };
  }

  const namespace = getProspectNamespace(prospectId);
  let indexed = 0;

  for (const post of posts) {
    if (!post.text || post.text.trim().length === 0) {
      continue;
    }

    try {
      await prospectRag.add(ctx, {
        namespace,
        text: post.text,
        filterValues: [{ name: "contentType", value: "evidence_post" }],
      });
      indexed++;
    } catch (error) {
      console.warn(
        `[RAG] Failed to index evidence post ${post.id}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  console.info(
    `[RAG] Indexed ${indexed}/${posts.length} evidence posts for prospect ${prospectId}`
  );

  return { indexed };
}

/**
 * Index pain points from enrichment to RAG.
 *
 * Called after enrichment succeeds. Indexes the identified pain points
 * so the agent can search for outreach context.
 *
 * @param ctx - Action context
 * @param prospectId - Prospect ID for namespace
 * @param painPoints - Pain points to index
 */
export async function indexPainPoints(
  ctx: ActionCtx,
  prospectId: string,
  painPoints: PainPointForRag[]
): Promise<{ indexed: number }> {
  if (painPoints.length === 0) {
    return { indexed: 0 };
  }

  const namespace = getProspectNamespace(prospectId);
  let indexed = 0;

  for (const pp of painPoints) {
    if (!pp.pain || pp.pain.trim().length === 0) {
      continue;
    }

    // Create a combined text with pain + solution for better context
    let text = `Pain point: ${pp.pain}`;
    if (pp.solution) {
      text += `\nHow we help: ${pp.solution}`;
    }

    try {
      await prospectRag.add(ctx, {
        namespace,
        text,
        filterValues: [{ name: "contentType", value: "pain_point" }],
      });
      indexed++;
    } catch (error) {
      console.warn(
        `[RAG] Failed to index pain point:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  console.info(
    `[RAG] Indexed ${indexed}/${painPoints.length} pain points for prospect ${prospectId}`
  );

  return { indexed };
}

/**
 * Index prospect profile/brief intro to RAG.
 *
 * Called after enrichment succeeds. Indexes the profile summary
 * for additional context during outreach.
 *
 * @param ctx - Action context
 * @param prospectId - Prospect ID for namespace
 * @param profile - Profile text (e.g., briefIntro, bio)
 */
export async function indexProfile(
  ctx: ActionCtx,
  prospectId: string,
  profile: string
): Promise<{ indexed: boolean }> {
  if (!profile || profile.trim().length === 0) {
    return { indexed: false };
  }

  const namespace = getProspectNamespace(prospectId);

  try {
    await prospectRag.add(ctx, {
      namespace,
      text: profile,
      filterValues: [{ name: "contentType", value: "profile" }],
    });

    console.info(`[RAG] Indexed profile for prospect ${prospectId}`);
    return { indexed: true };
  } catch (error) {
    console.warn(
      `[RAG] Failed to index profile:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return { indexed: false };
  }
}

/**
 * Index a query candidate for workspace-level discovery retrieval.
 */
export async function indexWorkspaceQueryCandidate(
  ctx: ActionCtx,
  candidate: QueryCandidateForRag
): Promise<{ indexed: boolean }> {
  const namespace = getWorkspaceNamespace(
    candidate.workspaceId,
    getNamespaceKindForQueryCandidate()
  );
  const text = buildQueryCandidateRagText({
    type: candidate.type,
    rawValue: candidate.rawValue,
    canonicalValue: candidate.canonicalValue,
    sourceTheme: candidate.sourceTheme,
    status: candidate.status,
  });

  try {
    await agentMemoryRag.add(ctx, {
      namespace,
      key: candidate.embeddingDocKey,
      title: candidate.rawValue,
      text,
      contentHash: buildContentHashFromText(text),
      importance: clampUnitInterval(candidate.importance, 0.5),
      metadata: {
        workspaceId: candidate.workspaceId,
        queryCandidateId: candidate.queryCandidateId,
        canonicalKey: candidate.canonicalKey,
        type: candidate.type,
      },
      filterValues: [{ name: "contentType", value: "query_candidate" }],
    });
    return { indexed: true };
  } catch (error) {
    console.warn(
      `[RAG] Failed to index query candidate ${candidate.queryCandidateId}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return { indexed: false };
  }
}

export async function indexWorkspaceMemoryDocument(
  ctx: ActionCtx,
  document: WorkspaceMemoryDocumentForRag
): Promise<{ indexed: boolean }> {
  const namespace = getWorkspaceNamespace(
    document.workspaceId,
    document.namespace
  );

  try {
    await agentMemoryRag.add(ctx, {
      namespace,
      key: document.key,
      title: document.title,
      text: document.text,
      contentHash: buildContentHashFromText(document.text),
      importance: clampUnitInterval(document.importance, 0.7),
      metadata: {
        workspaceId: document.workspaceId,
        prospectId: document.prospectId,
        memoryItemId: document.memoryItemId,
        category: document.category,
        namespace: document.namespace,
        source: document.source,
      },
      filterValues: [{ name: "contentType", value: "workspace_memory" }],
    });
    return { indexed: true };
  } catch (error) {
    console.warn(
      `[RAG] Failed to index workspace memory ${document.key}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return { indexed: false };
  }
}

export async function indexWorkspaceProspectSummary(
  ctx: ActionCtx,
  document: WorkspaceProspectSummaryForRag
): Promise<{ indexed: boolean }> {
  const namespace = getWorkspaceNamespace(
    document.workspaceId,
    document.namespace
  );

  try {
    await agentMemoryRag.add(ctx, {
      namespace,
      key: `workspace-prospect:${document.workspaceId}:${document.namespace}:${document.prospectId}`,
      title: document.title,
      text: document.text,
      contentHash: buildContentHashFromText(document.text),
      importance: clampUnitInterval(document.importance, 0.65),
      metadata: {
        workspaceId: document.workspaceId,
        prospectId: document.prospectId,
        namespace: document.namespace,
        summaryType: "prospect_summary",
      },
      filterValues: [
        { name: "contentType", value: "workspace_prospect_summary" },
      ],
    });
    return { indexed: true };
  } catch (error) {
    console.warn(
      `[RAG] Failed to index workspace prospect summary ${document.prospectId}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return { indexed: false };
  }
}

/**
 * Indexes a prospect into the workspace `prospect_search` RAG namespace for unified list search.
 */
export async function indexProspectSearchListEntry(
  ctx: ActionCtx,
  prospect: Doc<"prospects">
): Promise<{ indexed: boolean }> {
  const summary = buildProspectSummaryRecord(prospect);
  const text = summary.searchText?.trim();
  if (!text) {
    return { indexed: false };
  }
  const namespace = getWorkspaceNamespace(
    String(prospect.workspaceId),
    "prospect_search"
  );

  try {
    await agentMemoryRag.add(ctx, {
      namespace,
      key: `prospect-search:${String(prospect._id)}`,
      title: summary.displayName,
      text,
      contentHash: buildContentHashFromText(text),
      importance: 0.7,
      metadata: {
        workspaceId: String(prospect.workspaceId),
        prospectId: String(prospect._id),
      },
      filterValues: [{ name: "contentType", value: "prospect_search_list" }],
    });
    return { indexed: true };
  } catch (error) {
    console.warn(
      "[RAG] prospect_search list index failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return { indexed: false };
  }
}
