"use node";

import { v } from "convex/values";
import { NonRetryableError } from "@convex-dev/workpool";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { outreachAgent } from "./agents/outreach";
import { buildOutreachAgentPrompt } from "./agents/prompts";
import {
  resolveSocialContext,
  type ResolvedSocialContext,
} from "./agents/outreach/tools/socialContextShared";
import type { ToolContext } from "./agents/outreach/tools/helpers";
import { repairOverLimitCommentTasks } from "./agents/outreach/tools/xPostLimitHelpers";
import { internalAction } from "./lib/functionBuilders";
import { AUTO_PLAN_GENERATION_THRESHOLD } from "./lib/outreachCore";
import {
  assessAutoPlanGrounding,
  autoPlanTransportSchema,
  buildAutoPlanResearchQueries,
  buildGroundedAutoPlanPrompt,
  classifyAutoPlanFailure,
  hasVerifiedAutoPlanOutreachChannel,
  normalizeAutoPlanDraft,
  parseAutoPlanTransportDraft,
  validateAutoPlanDraftAgainstGrounding,
  type AutoPlanGenerationResult,
  type AutoPlanGroundingContext,
  type AutoPlanSocialPost,
} from "./lib/autoPlanCore";
import {
  isLinkedInDmPlanAllowed,
  type LinkedInRelationshipStatus,
} from "./lib/linkedinOutreachPlanCore";
import { isAutoPlanGroundingStageFresh } from "./lib/autoPlanGroundingCacheCore";
import { loadAgentProspectProfileContext } from "./lib/prospectProfileContextHelpers";
import { getProspectDisplayLabel } from "./lib/prospectIdentityCore";
import { persistRawModelResponse } from "./lib/modelTelemetry";
import {
  readWebPages,
  runDeepResearch,
  type ResearchQueryOutcome,
  type WebPageReadOutcome,
} from "./lib/researchCore";
import {
  autoPlanGenerationResultValidator,
  providerNameValidator,
} from "./validators";
import { getCurrentUTCTimestamp } from "../shared/lib/utils/time/timeUtils";
import { selectProfileWebsiteHref } from "../shared/lib/twitter/profileLinks";
import { getWorkspaceUseCase } from "../shared/lib/workspaceUseCases";
import { runWithWorkspaceMemoryCompliance } from "./lib/workspaceMemoryCompliance";

function throwClassifiedAutoPlanError(error: unknown): never {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const failure = classifyAutoPlanFailure(normalized);
  if (!failure.retryable) {
    throw new NonRetryableError(normalized.message, { cause: normalized });
  }
  throw normalized;
}

function createAutoPlanSocialContext(ctx: ActionCtx, userId: Id<"users">) {
  return {
    ...ctx,
    agent: outreachAgent,
    userId: String(userId),
    threadId: undefined,
    messageId: undefined,
  } as unknown as ToolContext;
}

async function ensureVisibleAutoPlanThread(
  ctx: ActionCtx,
  args: {
    prospectId: Id<"prospects">;
    userId: Id<"users">;
    prospectName: string;
    existingThreadId?: string;
  }
): Promise<string> {
  const threadId =
    args.existingThreadId ??
    (
      await ctx.runMutation(
        internal.prospectThreads.ensureActiveThreadForProspectInternal,
        {
          prospectId: args.prospectId,
          threadSummary: `Outreach plan created for ${args.prospectName}`,
        }
      )
    ).threadId;

  const messages = await outreachAgent.listMessages(ctx, {
    threadId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const hasVisibleMessage = messages.page.some((message) => {
    const role = message.message?.role;
    return role === "user" || role === "assistant";
  });
  if (!hasVisibleMessage) {
    await outreachAgent.saveMessage(ctx, {
      threadId,
      userId: String(args.userId),
      message: {
        role: "assistant",
        content: `The outreach plan for ${args.prospectName} is ready to review.`,
      },
      skipEmbeddings: true,
    });
  }
  await ctx.runMutation(internal.prospectThreads.markThreadHasVisibleMessages, {
    threadId,
  });

  return threadId;
}

function toPromptSafePosts(
  context: ResolvedSocialContext | null
): AutoPlanSocialPost[] {
  return (context?.posts ?? []).map((post) => ({
    id: post.id,
    platform: post.platform,
    createdAt: post.createdAt,
    textPreview: post.textPreview,
    url: post.url,
    metrics: post.metrics,
    isReply: post.isReply,
  }));
}

function countStoredSignals(prospect: {
  briefIntro?: string;
  matchReason?: string;
  matchedKeywords?: string[];
  evidencePosts?: unknown[];
  painPoints?: Array<{ pain: string }>;
  finance?: { displayValue: string };
}): number {
  return [
    prospect.briefIntro,
    prospect.matchReason,
    prospect.finance?.displayValue,
    ...(prospect.matchedKeywords ?? []),
    ...(prospect.painPoints?.map((painPoint) => painPoint.pain) ?? []),
    ...(prospect.evidencePosts ?? []),
  ].filter(Boolean).length;
}

export const probeAutoPlanProviderHealth = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    providers: v.array(providerNameValidator),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    const prospect = await ctx.runQuery(
      internal.prospects.getProspectInternal,
      {
        prospectId: args.prospectId,
      }
    );
    if (
      !prospect ||
      prospect.workspaceId !== args.workspaceId ||
      prospect.userId !== args.userId ||
      prospect.platform !== "twitter"
    ) {
      throw new Error("No eligible X/Twitter provider health-check target");
    }

    if (args.providers.includes("socialapi")) {
      await resolveSocialContext(
        createAutoPlanSocialContext(ctx, args.userId),
        {
          mode: "platform_profile",
          platform: "twitter",
          limit: 1,
          trustedProspectId: args.prospectId,
        }
      );
    }

    if (args.providers.includes("exa")) {
      const outcomes = await runDeepResearch(
        [getProspectDisplayLabel(prospect)],
        {
          ctx,
          consumer: "autoPlan.recoveryHealthCheck",
          workspaceId: args.workspaceId,
          prospectId: args.prospectId,
        }
      );
      const failedOutcome = outcomes.find((outcome) => outcome.error);
      if (failedOutcome?.error) {
        throw new Error(failedOutcome.error);
      }
    }

    return { success: true };
  },
});

/**
 * Mandatory grounding and structured generation for one automatic plan.
 * The durable workflow retries this idempotent action when external providers
 * or the model fail before a valid plan is persisted.
 */
export const generateGroundedAutoPlanDraft = internalAction({
  args: {
    prospectId: v.id("prospects"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    runId: v.id("autoPlanRuns"),
  },
  returns: autoPlanGenerationResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<AutoPlanGenerationResult<Id<"outreachPlans">>> => {
    await ctx.runMutation(internal.autoPlanRuns.markAutoPlanRunStarted, {
      runId: args.runId,
    });

    const [prospect, workspace, workspaceInspection, existingPlan] =
      await Promise.all([
        ctx.runQuery(internal.prospects.getProspectInternal, {
          prospectId: args.prospectId,
        }),
        ctx.runQuery(internal.workspaces.getById, {
          workspaceId: args.workspaceId,
        }),
        ctx.runQuery(internal.workspaces.getWorkspaceInspectionInternal, {
          workspaceId: args.workspaceId,
        }),
        ctx.runQuery(internal.outreach.getProspectActivePlanInternal, {
          prospectId: args.prospectId,
        }),
      ]);

    if (existingPlan) {
      const existingThreadId = existingPlan.plan.threadId;
      const threadId = await ensureVisibleAutoPlanThread(ctx, {
        prospectId: args.prospectId,
        userId: args.userId,
        prospectName: getProspectDisplayLabel(prospect),
        existingThreadId,
      });
      await ctx.runMutation(internal.outreach.attachPlanThreadInternal, {
        planId: existingPlan.plan._id,
        threadId,
      });
      return {
        success: true,
        planId: existingPlan.plan._id,
        threadId,
        existing: true,
      };
    }

    if (
      !prospect ||
      !workspace ||
      !workspaceInspection ||
      prospect.workspaceId !== args.workspaceId ||
      prospect.userId !== args.userId
    ) {
      throw new NonRetryableError(
        "Auto plan context does not match the prospect workspace"
      );
    }
    if (
      prospect.origin === "setup_preview" ||
      prospect.status === "archived" ||
      prospect.qualificationStatus !== "qualified" ||
      (prospect.enrichmentStatus !== "enriched" &&
        prospect.enrichmentStatus !== "partial") ||
      typeof prospect.qualificationScore !== "number" ||
      prospect.qualificationScore < AUTO_PLAN_GENERATION_THRESHOLD
    ) {
      throw new NonRetryableError(
        "Prospect is no longer eligible for automatic planning"
      );
    }
    const qualificationScore = prospect.qualificationScore;
    const paidEligibility = await ctx.runQuery(
      internal.plans.getPaidFeatureEligibilityByUserId,
      { userId: args.userId }
    );
    if (!paidEligibility.allowed) {
      throw new NonRetryableError(
        paidEligibility.reason ??
          "Workspace plan does not include outreach plans"
      );
    }

    const stylePlatform =
      prospect.platform === "linkedin" ? "linkedin" : "twitter";
    let styleContext = await ctx.runQuery(
      internal.workspaceStyleProfiles.getWorkspaceWritingStyleContextInternal,
      {
        workspaceId: args.workspaceId,
        platform: stylePlatform,
      }
    );
    if (styleContext.status !== "ready") {
      const platformRepair = await ctx.runMutation(
        internal.styleAnalysis.bootstrapWorkspaceStyleProfileForPlatform,
        {
          workspaceId: args.workspaceId,
          userId: args.userId,
          platform: stylePlatform,
        }
      );
      if (platformRepair?.reason === "already_initialized") {
        styleContext = await ctx.runQuery(
          internal.workspaceStyleProfiles
            .getWorkspaceWritingStyleContextInternal,
          {
            workspaceId: args.workspaceId,
            platform: stylePlatform,
          }
        );
      }
      if (styleContext.status !== "ready") {
        if (
          platformRepair?.reason === "scheduled" ||
          platformRepair?.reason === "already_queued" ||
          platformRepair?.reason === "already_initialized"
        ) {
          throw new NonRetryableError(
            "Workspace writing style repair is in progress"
          );
        }
        throw new NonRetryableError(
          "Workspace writing style repair needs support"
        );
      }
    }
    const writingStyle = styleContext.writingStyle;
    const prospectProfileContext = await loadAgentProspectProfileContext(
      ctx,
      prospect
    );

    const socialContextCtx = createAutoPlanSocialContext(ctx, args.userId);
    const websiteUrl = selectProfileWebsiteHref(
      prospect.websiteHref,
      prospect.websiteUrl
    );
    const researchQueries = buildAutoPlanResearchQueries({
      displayName: getProspectDisplayLabel(prospect),
      title: prospect.title,
      company: prospect.company,
      workspaceDescription: workspaceInspection.description,
    });

    const now = getCurrentUTCTimestamp();
    const cachedGrounding = await ctx.runQuery(
      internal.autoPlanGroundingCache.getAutoPlanGroundingCacheInternal,
      { prospectId: args.prospectId }
    );

    let refreshedProfile =
      isAutoPlanGroundingStageFresh(
        cachedGrounding?.platformProfileCompletedAt,
        now
      ) && cachedGrounding?.platformProfile !== undefined
        ? (cachedGrounding.platformProfile as ResolvedSocialContext | null)
        : undefined;
    if (refreshedProfile === undefined) {
      try {
        refreshedProfile = await resolveSocialContext(socialContextCtx, {
          mode: "platform_profile",
          platform: "auto",
          limit: 10,
          trustedProspectId: args.prospectId,
        });
        await ctx.runMutation(
          internal.autoPlanGroundingCache.saveAutoPlanGroundingStageInternal,
          {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            stage: "platform_profile",
            value: refreshedProfile,
          }
        );
      } catch (error) {
        throwClassifiedAutoPlanError(
          new Error(
            `Platform profile refresh failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }

    let recentPosts =
      isAutoPlanGroundingStageFresh(
        cachedGrounding?.recentPostsCompletedAt,
        now
      ) && Array.isArray(cachedGrounding?.recentPosts)
        ? (cachedGrounding.recentPosts as AutoPlanSocialPost[])
        : undefined;
    if (recentPosts === undefined) {
      try {
        const postsContext = await resolveSocialContext(socialContextCtx, {
          mode: "posts",
          platform: "auto",
          limit: 10,
          includeReplies: true,
          trustedProspectId: args.prospectId,
        });
        recentPosts = toPromptSafePosts(postsContext);
        await ctx.runMutation(
          internal.autoPlanGroundingCache.saveAutoPlanGroundingStageInternal,
          {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            stage: "recent_posts",
            value: recentPosts,
          }
        );
      } catch (error) {
        throwClassifiedAutoPlanError(
          new Error(
            `Recent posts refresh failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }

    const researchProviderContext = {
      ctx,
      consumer: "autoPlan.grounding",
      workspaceId: args.workspaceId,
      prospectId: args.prospectId,
      autoPlanRunId: args.runId,
    };
    let websiteResearch: WebPageReadOutcome[] | undefined =
      isAutoPlanGroundingStageFresh(
        cachedGrounding?.websiteResearchCompletedAt,
        now
      ) && Array.isArray(cachedGrounding?.websiteResearch)
        ? (cachedGrounding.websiteResearch as WebPageReadOutcome[])
        : undefined;
    if (websiteResearch === undefined) {
      websiteResearch = await readWebPages(
        websiteUrl ? [websiteUrl] : [],
        researchProviderContext
      );
      if (!websiteResearch.some((page) => page.error)) {
        await ctx.runMutation(
          internal.autoPlanGroundingCache.saveAutoPlanGroundingStageInternal,
          {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            stage: "website_research",
            value: websiteResearch,
          }
        );
      }
    }

    let webResearch: ResearchQueryOutcome[] | undefined =
      isAutoPlanGroundingStageFresh(
        cachedGrounding?.webResearchCompletedAt,
        now
      ) && Array.isArray(cachedGrounding?.webResearch)
        ? (cachedGrounding.webResearch as ResearchQueryOutcome[])
        : undefined;
    if (webResearch === undefined) {
      webResearch = await runDeepResearch(
        researchQueries,
        researchProviderContext
      );
      if (!webResearch.some((result) => result.error)) {
        await ctx.runMutation(
          internal.autoPlanGroundingCache.saveAutoPlanGroundingStageInternal,
          {
            prospectId: args.prospectId,
            workspaceId: args.workspaceId,
            stage: "web_research",
            value: webResearch,
          }
        );
      }
    }

    const retrievalErrors = [
      ...websiteResearch
        .filter((page) => page.error)
        .map((page) => `website ${page.url}: ${page.error}`),
      ...webResearch
        .filter((result) => result.error)
        .map((result) => `research ${result.query}: ${result.error}`),
    ].filter((message): message is string => Boolean(message));

    let linkedinRelationship: LinkedInRelationshipStatus | null = null;
    let linkedinHasExistingConversation = false;
    if (prospect.platform === "linkedin") {
      try {
        const relationship = await ctx.runAction(
          internal.linkedin.getLinkedInProspectRelationshipInternal,
          {
            userId: args.userId,
            prospectId: args.prospectId,
          }
        );
        linkedinRelationship = relationship.status;
        linkedinHasExistingConversation = relationship.hasExistingConversation;
      } catch (error) {
        console.warn(
          "[AutoPlan] Failed to load LinkedIn relationship for planning",
          {
            prospectId: String(args.prospectId),
            error: error instanceof Error ? error.message : String(error),
          }
        );
        linkedinRelationship = "unknown";
      }

      if (
        !hasVerifiedAutoPlanOutreachChannel({
          platform: prospect.platform,
          recentPostCount: recentPosts.length,
          linkedinRelationship,
          linkedinHasExistingConversation,
        })
      ) {
        throw new NonRetryableError(
          "LinkedIn provider data unavailable: no verified recent LinkedIn posts are available and messaging eligibility could not be verified."
        );
      }
    }

    const groundingContext: AutoPlanGroundingContext = {
      generatedAt: getCurrentUTCTimestamp(),
      workspace: {
        ...workspaceInspection,
        useCaseKey: workspaceInspection.useCaseKey
          ? String(workspaceInspection.useCaseKey)
          : null,
      },
      prospectProfileContext,
      storedSignalCount: countStoredSignals(prospect),
      writingStyle,
      freshPlatformProfile: refreshedProfile?.profile ?? null,
      recentPosts,
      websiteResearch,
      webResearch,
      retrievalErrors,
      linkedinRelationship,
      linkedinHasExistingConversation,
    };
    const groundingAssessment = assessAutoPlanGrounding(groundingContext);
    if (!groundingAssessment.ready) {
      let retrievalFailure: string | undefined;
      for (const retrievalError of retrievalErrors) {
        if (classifyAutoPlanFailure(retrievalError).retryable) {
          retrievalFailure = retrievalError;
          break;
        }
      }
      if (retrievalFailure) {
        throw new Error(
          `Auto plan grounding incomplete after a transient retrieval failure: ${retrievalFailure}`
        );
      }
      throw new NonRetryableError(
        `Auto plan grounding incomplete: ${groundingAssessment.reasons.join("; ")}`
      );
    }

    const useCase = getWorkspaceUseCase(workspace.useCaseKey);
    const workspaceMemoryContext = await ctx.runAction(
      internal.memory.buildWorkspaceMemoryContextInternal,
      {
        workspaceId: args.workspaceId,
        userId: args.userId,
        prospectId: args.prospectId,
        surface: "auto_plan",
        channel: prospect.platform === "linkedin" ? "linkedin" : "twitter",
        query: [
          getProspectDisplayLabel(prospect),
          prospect.title ?? "",
          prospect.company ?? "",
          prospect.briefIntro ?? "",
          ...(prospect.matchedKeywords ?? []),
          ...(prospect.painPoints?.map((painPoint) => painPoint.pain) ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      }
    );
    const autoPlanPrompt = buildGroundedAutoPlanPrompt({
      prospectName: getProspectDisplayLabel(prospect),
      prospectTitle: prospect.title || "prospect",
      qualificationScore,
      entitySingularLower: useCase.entitySingular.toLowerCase(),
      successDefinition: useCase.promptContext.successDefinition,
      outreachGoal: useCase.promptContext.outreachGoal,
      context: groundingContext,
    });
    const autoPlanSystem = [
      buildOutreachAgentPrompt(useCase),
      workspaceMemoryContext.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");
    const generated = await (async () => {
      try {
        const generateAutoPlanCandidate = async (repairInstruction?: string) =>
          await outreachAgent.generateObject(
            ctx,
            { userId: String(args.userId) },
            {
              schema: autoPlanTransportSchema,
              system: autoPlanSystem,
              prompt: repairInstruction
                ? `${autoPlanPrompt}\n\nThe previous candidate violated workspace policy. Regenerate the complete object with this repair: ${repairInstruction}`
                : autoPlanPrompt,
              maxOutputTokens: 3_000,
            },
            {
              storageOptions: { saveMessages: "none" },
              contextOptions: {
                recentMessages: 0,
                searchOtherThreads: false,
                searchOptions: {
                  limit: 0,
                  textSearch: false,
                  vectorSearch: false,
                },
              },
            }
          );
        const complianceResult = await runWithWorkspaceMemoryCompliance<
          Awaited<ReturnType<typeof generateAutoPlanCandidate>>
        >({
          instructions: workspaceMemoryContext.complianceInstructions,
          taskContext: autoPlanPrompt,
          maxAttempts: 2,
          serialize: (result) => JSON.stringify(result.object),
          generate: generateAutoPlanCandidate,
        });
        return complianceResult.value;
      } catch (error) {
        throwClassifiedAutoPlanError(error);
      }
    })();
    await persistRawModelResponse(ctx, {
      userId: String(args.userId),
      agentName: "Outreach Agent",
      request: generated.request,
      response: generated.response,
      providerMetadata: generated.providerMetadata,
    });

    const normalizedDraft = normalizeAutoPlanDraft(
      parseAutoPlanTransportDraft(generated.object),
      {
        platform: prospect.platform,
        linkedinRelationship,
        linkedinHasExistingConversation,
      }
    );
    const hasConcreteOutreach = normalizedDraft.tasks.some(
      (task) =>
        task.type === "comment" || task.type === "dm" || task.type === "react"
    );
    if (
      !hasConcreteOutreach &&
      prospect.platform === "linkedin" &&
      !isLinkedInDmPlanAllowed(
        linkedinRelationship,
        linkedinHasExistingConversation
      )
    ) {
      throw new NonRetryableError(
        "LinkedIn auto-plan requires a comment or reaction when messaging is unavailable. No suitable public engagement task was generated."
      );
    }
    const validationErrors = validateAutoPlanDraftAgainstGrounding({
      draft: normalizedDraft,
      recentPosts,
      platform: prospect.platform,
      linkedinRelationship,
      linkedinHasExistingConversation,
    });
    if (validationErrors.length > 0) {
      throw new Error(
        `Generated plan failed validation: ${validationErrors.join("; ")}`
      );
    }

    const repairedTasks =
      prospect.platform === "twitter"
        ? (
            await repairOverLimitCommentTasks({
              ctx,
              userId: args.userId,
              tasks: normalizedDraft.tasks,
            })
          ).tasks
        : normalizedDraft.tasks;
    const planTasks = repairedTasks.map((task) => ({
      ...task,
      approvalContext:
        task.type === "comment" || task.type === "dm" || task.type === "react"
          ? { platform: prospect.platform }
          : undefined,
    }));

    let planId: Id<"outreachPlans">;
    let persistedThreadId: string | undefined;
    try {
      planId = await ctx.runMutation(internal.outreach.createPlan, {
        prospectId: args.prospectId,
        workspaceId: args.workspaceId,
        userId: args.userId,
        strategy: normalizedDraft.strategy,
        tasks: planTasks,
      });
    } catch (error) {
      const racedPlan = await ctx.runQuery(
        internal.outreach.getProspectActivePlanInternal,
        { prospectId: args.prospectId }
      );
      if (!racedPlan) {
        throw error;
      }
      planId = racedPlan.plan._id;
      persistedThreadId = racedPlan.plan.threadId;
    }

    const threadId = await ensureVisibleAutoPlanThread(ctx, {
      prospectId: args.prospectId,
      userId: args.userId,
      prospectName: getProspectDisplayLabel(prospect),
      existingThreadId: persistedThreadId,
    });
    await ctx.runMutation(internal.outreach.attachPlanThreadInternal, {
      planId,
      threadId,
    });

    return {
      success: true,
      planId,
      threadId,
      existing: false,
    };
  },
});
