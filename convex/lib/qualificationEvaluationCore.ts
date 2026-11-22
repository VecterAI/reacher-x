"use node";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  collectQualificationDiscoveryEvidence,
  getQualificationProfileText,
} from "./qualificationDiscoveryEvidenceCore";
import { isRecord } from "./typeGuards";
import { hydrateQualificationEvidence } from "./qualificationEvidenceCore";
import {
  qualifyProspectCore,
  type QualificationCoreParams,
  type QualificationResult,
} from "./qualificationCore";
import { readWebPages } from "./researchCore";
import { getWorkflowEvidencePostId } from "./workflowSafeProspect";

type EvaluationArgs = Omit<QualificationCoreParams, "externalArticles"> & {
  workspaceId: Id<"workspaces">;
  prospectId: Id<"prospects">;
};

/** The evidence a qualification verdict is based on. */
export type GatheredQualificationEvidence = Pick<
  QualificationCoreParams,
  "evidencePosts" | "profileData" | "profileEvidence" | "externalArticles"
>;

/**
 * Evaluates persisted social evidence plus any readable linked articles.
 * People-search seeds acquire and cache real profile/activity evidence first.
 * Workflows and audits share the same evidence and qualification rules.
 */
export async function evaluateQualificationWithExternalArticles(
  ctx: ActionCtx,
  args: EvaluationArgs
): Promise<QualificationResult> {
  return await qualifyGatheredEvidence(
    ctx,
    args,
    await gatherQualificationEvidence(ctx, args)
  );
}

/**
 * The evidence step of `evaluateQualificationWithExternalArticles`: the
 * people-search seed's profile and activity (provider calls, cached on the
 * prospect) or its stored posts, plus readable linked articles.
 */
export async function gatherQualificationEvidence(
  ctx: ActionCtx,
  args: EvaluationArgs
): Promise<GatheredQualificationEvidence> {
  // Workflow steps carry Unicode-safe previews. Read full persisted text here,
  // outside the workflow journal, and only for the selected source identities.
  let evidencePosts = args.evidencePosts;
  let profileData = args.profileData;
  let profileEvidence: QualificationCoreParams["profileEvidence"];
  const prospect = await ctx.runQuery(internal.prospects.getProspectInternal, {
    prospectId: args.prospectId,
  });
  if (
    !prospect ||
    prospect.workspaceId !== args.workspaceId ||
    prospect.platform !== args.platform
  ) {
    throw new Error("Qualification evidence prospect scope mismatch");
  }
  const acquired = await collectQualificationDiscoveryEvidence(ctx, prospect);
  if (acquired) {
    profileData = acquired.profileData;
    evidencePosts = acquired.evidencePosts;
    const url = typeof profileData.url === "string" ? profileData.url : "";
    const authorId = typeof profileData.urn === "string" ? profileData.urn : "";
    const text = getQualificationProfileText(profileData);
    if (url && authorId && text) profileEvidence = { url, authorId, text };
  } else {
    evidencePosts = hydrateQualificationEvidence({
      selectedPosts: evidencePosts,
      storedPosts: (prospect.evidencePosts ?? []).filter(isRecord),
    });
  }
  const articleSourcePostIdsByUrl = new Map<string, string[]>();
  for (const post of evidencePosts) {
    const sourcePostId = getWorkflowEvidencePostId(post);
    const externalUrls = Array.isArray(post.externalUrls)
      ? post.externalUrls.filter(
          (value): value is string => typeof value === "string"
        )
      : [];
    if (!sourcePostId) continue;

    for (const url of externalUrls) {
      articleSourcePostIdsByUrl.set(url, [
        ...(articleSourcePostIdsByUrl.get(url) ?? []),
        sourcePostId,
      ]);
    }
  }

  const articleReads =
    articleSourcePostIdsByUrl.size > 0
      ? await readWebPages([...articleSourcePostIdsByUrl.keys()], {
          ctx,
          consumer: "qualification.external_articles",
          workspaceId: args.workspaceId,
          prospectId: args.prospectId,
        })
      : [];
  const externalArticles = articleReads.flatMap((article) => {
    if (!article.author || !article.snippet) return [];

    return (articleSourcePostIdsByUrl.get(article.url) ?? []).map(
      (sourcePostId) => ({
        sourcePostId,
        url: article.url,
        author: article.author as string,
        text: article.snippet as string,
      })
    );
  });

  return { evidencePosts, profileData, profileEvidence, externalArticles };
}

/** The model step of `evaluateQualificationWithExternalArticles`: the paid verdict. */
export async function qualifyGatheredEvidence(
  ctx: ActionCtx,
  args: EvaluationArgs,
  evidence: GatheredQualificationEvidence
): Promise<QualificationResult> {
  return await qualifyProspectCore({
    ...args,
    ...evidence,
    telemetry: {
      ctx,
      agentName: "Qualification Evaluator",
      workspaceId: args.workspaceId,
    },
  });
}
