// convex/agents/tools/createWorkspace.ts
// Create or update workspace with v4 fields and auto-start prospecting

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal, components } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { icpSchema } from "./schemas";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import {
  createOnboardingArtifact,
  type AgentArtifactEnvelope,
} from "../../../shared/lib/json-render/agentArtifacts";
import { WORKSPACE_NAME_CONSTRAINTS } from "../../../shared/lib/utils/validation/validation";
import {
  assertValidWorkspaceName,
  normalizeWorkspaceNameForSuggestion,
} from "../../lib/workspaceNameHelpers";
import { getSetupThreadTitle } from "../../lib/setupThreadHelpers";
import { hasRequiredWorkspaceAgentData } from "../../lib/workspaceSetup";
import { DEFAULT_WORKSPACE_USE_CASE_KEY } from "../../../shared/lib/workspaceUseCases";
import { resolveSetupThreadState } from "./workspaceSetupContext";
import { isTerminalSetupSessionStatus } from "../../lib/setupSessionCore";

// ============================================================================
// Tool
// ============================================================================

/**
 * Creates or updates a workspace with the approved description and ICPs.
 * If user has an existing incomplete default workspace, update it.
 * Otherwise create a new one.
 * After success, automatically starts the prospecting workflow.
 */
export const createWorkspace = createTool({
  description:
    "Create or update a workspace with the approved business description and ICPs. ONLY call this after the user explicitly approves the generated content by saying something like 'looks good' or 'create workspace'. This will also start finding prospects automatically.",
  args: z.object({
    name: z
      .string()
      .min(WORKSPACE_NAME_CONSTRAINTS.MIN_LENGTH)
      .max(WORKSPACE_NAME_CONSTRAINTS.MAX_LENGTH)
      .describe("The workspace name (usually the business name)"),
    seedDescription: z.string().describe("The original seed description"),
    improvedDescription: z.string().describe("The AI-improved description"),
    icps: z
      .array(icpSchema)
      .min(2)
      .max(4)
      .describe("The approved ICP segments"),
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe("The source URL if provided"),
    descriptionSource: z
      .enum(["url", "manual"])
      .describe("Whether description came from URL analysis or manual input"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    workspaceId?: string;
    workspaceName?: string;
    isUpdate?: boolean;
    prospectingStarted?: boolean;
    artifact?: AgentArtifactEnvelope;
    error?: string;
    errorCode?: "limit_reached" | "unauthorized" | "unknown";
    eligibility?: {
      tier: "free" | "base" | "pro";
      used: number;
      limit: number;
      remaining: number;
    };
  }> => {
    if (!ctx.userId) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    try {
      const userId = ctx.userId as Id<"users">;
      const normalizedWorkspaceName = assertValidWorkspaceName(args.name);

      if (ctx.threadId) {
        const setupSession = await ctx.runQuery(
          internal.setupSessions.getByThreadIdInternal,
          { threadId: ctx.threadId }
        );
        if (setupSession) {
          if (setupSession.status === "ready") {
            return {
              success: false,
              error:
                "This setup thread already created a workspace. Continue in the app or start a new workspace from the sidebar.",
            };
          }
          if (!isTerminalSetupSessionStatus(setupSession.status)) {
            return {
              success: false,
              error:
                "Workspace creation is handled in the onboarding panel. Use Done or Yes on the satisfaction strip when preview people are ready—do not create a workspace from chat during setup.",
            };
          }
        }
      }

      // Reuse an existing incomplete default workspace instead of creating
      // another record for the same setup flow.
      const existingDefault = await ctx.runQuery(
        internal.workspaces.getDefaultWorkspaceByUserId,
        { userId }
      );
      const setupThreadState = await resolveSetupThreadState(ctx, ctx.threadId);
      const resolvedUseCaseKey =
        setupThreadState?.useCaseKey ??
        existingDefault?.useCaseKey ??
        DEFAULT_WORKSPACE_USE_CASE_KEY;
      const shouldForceCreateNewWorkspace =
        setupThreadState?.mode === "newWorkspace";
      const shouldReuseIncompleteWorkspace =
        existingDefault !== null &&
        existingDefault !== undefined &&
        !hasRequiredWorkspaceAgentData(
          existingDefault as typeof existingDefault & {
            improvedDescription?: string | undefined;
            icps?: typeof existingDefault.icps;
          }
        );
      const incompleteDefaultWorkspace = shouldReuseIncompleteWorkspace
        ? existingDefault
        : null;

      let workspaceId: Id<"workspaces">;
      let isUpdate = false;
      let finalWorkspaceName = normalizedWorkspaceName;

      if (!shouldForceCreateNewWorkspace && incompleteDefaultWorkspace) {
        // Update existing incomplete workspace instead of creating new
        await ctx.runMutation(internal.workspaces.updateWorkspaceInternal, {
          workspaceId: incompleteDefaultWorkspace._id,
          description: args.improvedDescription,
          seedDescription: args.seedDescription,
          improvedDescription: args.improvedDescription,
          icps: args.icps,
          sourceUrl: args.sourceUrl,
          descriptionSource: args.descriptionSource,
          useCaseKey: resolvedUseCaseKey,
          setupCompletedAt: getCurrentUTCTimestamp(),
        });
        workspaceId = incompleteDefaultWorkspace._id;
        isUpdate = true;
        finalWorkspaceName = normalizeWorkspaceNameForSuggestion(
          incompleteDefaultWorkspace.name,
          normalizedWorkspaceName
        );
      } else {
        const workspaceEligibility = await ctx.runQuery(
          internal.plans.getWorkspaceCreationEligibilityByUserId,
          { userId }
        );
        if (!workspaceEligibility.allowed) {
          return {
            success: false,
            error:
              workspaceEligibility.reason ??
              "Workspace limit reached for your current plan.",
            errorCode: "limit_reached",
            eligibility: {
              tier: workspaceEligibility.tier,
              used: workspaceEligibility.used,
              limit: workspaceEligibility.limit,
              remaining: workspaceEligibility.remaining,
            },
          };
        }

        // Create new workspace
        workspaceId = await ctx.runMutation(
          internal.workspaces.createWorkspaceInternal,
          {
            userId,
            name: normalizedWorkspaceName,
            description: args.improvedDescription,
            seedDescription: args.seedDescription,
            improvedDescription: args.improvedDescription,
            icps: args.icps,
            sourceUrl: args.sourceUrl,
            descriptionSource: args.descriptionSource,
            useCaseKey: resolvedUseCaseKey,
            isDefault: true,
          }
        );
      }

      let setupSessionId: Id<"workspaceSetupSessions"> | null = null;
      if (ctx.threadId) {
        try {
          const setupSession = await ctx.runQuery(
            internal.setupSessions.getByThreadIdInternal,
            { threadId: ctx.threadId }
          );
          await ctx.runMutation(
            internal.workspaces.setOnboardingThreadInternal,
            {
              workspaceId,
              threadId: ctx.threadId,
            }
          );
          await ctx.runMutation(components.agent.threads.updateThread, {
            threadId: ctx.threadId,
            patch: {
              title: getSetupThreadTitle(workspaceId),
            },
          });
          if (setupSession) {
            setupSessionId = setupSession._id;
            await ctx.runMutation(
              internal.setupSessions.recordPreviewWorkspaceProvisionedInternal,
              {
                sessionId: setupSession._id,
                targetWorkspaceId: workspaceId,
                workspaceName: finalWorkspaceName,
              }
            );
          }
        } catch (threadLinkError) {
          console.warn(
            "[createWorkspace] Failed to link setup thread to workspace:",
            threadLinkError
          );
        }
      }

      // Auto-start prospecting workflow
      let prospectingStarted = false;
      try {
        const workflowResult = await ctx.runAction(
          setupSessionId
            ? internal.workspaces.restartProspectingWorkflowForSetupInternal
            : internal.workspaces.startProspectingWorkflowInternal,
          { workspaceId }
        );
        prospectingStarted = workflowResult.success;
      } catch (err) {
        // Log but don't fail - workspace was created successfully
        console.warn("[createWorkspace] Failed to start prospecting:", err);
      }

      return {
        success: true,
        workspaceId,
        workspaceName: finalWorkspaceName,
        isUpdate,
        prospectingStarted,
        artifact: createOnboardingArtifact(workspaceId),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isLimitError = /workspace limit reached/i.test(errorMessage);
      return {
        success: false,
        error: `Failed to create workspace: ${errorMessage}`,
        errorCode: isLimitError ? "limit_reached" : "unknown",
      };
    }
  },
});
