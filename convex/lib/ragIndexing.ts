"use node";

// convex/lib/ragIndexing.ts
// Helper functions for indexing prospect context to RAG
// Used by: workflows/qualification.ts, workflows/enrichment.ts

import { ActionCtx } from "../_generated/server";
import { prospectRag, getProspectNamespace } from "../agents/outreach/rag";
import { EvidencePost } from "./enrichmentCore";

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
