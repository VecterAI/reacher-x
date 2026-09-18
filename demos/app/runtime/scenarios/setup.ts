import {
  isUseCaseWalkthrough,
  USE_CASE_WALKTHROUGH_COPY,
} from "@/features/blog/lib/useCaseWalkthroughCopy";
import { getWorkspaceUseCase } from "@/shared/lib/workspaceUseCases";
import type { registerWorkspaceServices } from "../workspaceServices";
import { buildSetupHref } from "@/shared/lib/urls/setupHref";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildSetupFlowState,
  getNextSetupStatusAfterProvisioning,
} from "@/convex/lib/setupFlowCore";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import type { LocalClient } from "../LocalClient";
import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import { createAudienceProspect } from "./audiences";
import { createScenarioDraftPlan } from "../scenarioPlanHelpers";

import { getDemoSetupThreadId } from "./setupHelpers";

/** A connected, paid demo account uses the same conditional setup gates as the app. */
export function registerSetupStory(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  agent: AgentServices,
  workspaceServices: ReturnType<typeof registerWorkspaceServices>
) {
  const walkthroughId =
    state.scenario === "introducing-reacherx-v4"
      ? "find-candidates"
      : state.scenario;
  const walkthrough = isUseCaseWalkthrough(walkthroughId)
    ? USE_CASE_WALKTHROUGH_COPY[walkthroughId]
    : undefined;
  let active =
    Boolean(walkthrough) || state.scenario === "getting-started-with-reacherx";
  const target = state.workspaces[0];
  const audiencePeople = state.prospects.filter(
    (person) =>
      person.workspaceId === target._id &&
      person.status !== "converted" &&
      person.status !== "archived"
  );
  if (walkthrough)
    audiencePeople.forEach((person) => {
      state.plans.delete(person._id);
      person.planGenerationStatus = undefined;
    });
  type Session = NonNullable<
    FunctionReturnType<typeof api.setupSessions.getSetupSessionState>
  >;
  const threadId = getDemoSetupThreadId(state.scenario);
  const session: Session = {
    sessionId: "demo_setup_session" as Id<"workspaceSetupSessions">,
    threadId,
    status: "awaiting_input",
    mode: "new_workspace",
    useCaseKey: walkthrough ? target.useCaseKey : "recruiting",
    displayName: walkthrough
      ? `New ${getWorkspaceUseCase(target.useCaseKey).entitySingular.toLowerCase()} workspace`
      : "New recruiting workspace",
    draftName: null,
    ...buildSetupFlowState({
      status: "awaiting_input",
      requiresConnections: false,
      requiresPlan: false,
    }),
    panelStep: "input",
    googleConnected: true,
    googleEmail: "maya@example.test",
    xConnected: true,
    inputMode: null,
    sourceUrl: null,
    seedDescription: null,
    improvedDescription: null,
    generationRevision: 0,
    generationRequestedAt: null,
    generationSourceMessageId: null,
    generatedProfiles: [],
    preferenceChoice: null,
    planChoice: null,
    targetWorkspaceId: null,
    existingWorkspaceId: null,
    hasGeneration: false,
    statusUpdatedAt: getCurrentUTCTimestamp(),
    errorMessage: null,
  };
  const updateFlow = () => {
    Object.assign(
      session,
      buildSetupFlowState({
        status: session.status,
        requiresConnections: false,
        requiresPlan: false,
      })
    );
    session.panelStep = session.currentStepId;
    session.statusUpdatedAt = getCurrentUTCTimestamp();
  };
  client.register(api.shell.getAppShellState, () => {
    const shell = workspaceServices.getShellState();
    if (!active || session.status === "ready") return shell;
    return {
      ...shell,
      activeContextType: "setup_session" as const,
      effectiveUseCaseKey: session.useCaseKey!,
      pendingNotificationCount: undefined,
      locked: true,
      lockState: session.status,
      redirect: {
        sessionId: session.sessionId,
        threadId,
        href: buildSetupHref(threadId),
      },
      activeSetupSessionId: session.sessionId,
      workspaceSystemStatus: null,
      actionableReadyCount: 0,
      readyQualifiedEnrichedCount: 0,
      activeSetupSession: {
        sessionId: session.sessionId,
        threadId,
        status: session.status,
        displayName: session.draftName ?? session.displayName,
        useCaseKey: session.useCaseKey,
      },
      switcherItems: [
        {
          kind: "draft" as const,
          value: session.sessionId,
          sessionId: session.sessionId,
          threadId,
          label: session.draftName ?? session.displayName,
          isActive: true,
          locked: false,
          entitlementSlot: 3,
        },
        ...shell.switcherItems
          .filter(
            (item) =>
              !walkthrough ||
              item.kind !== "workspace" ||
              item.workspaceId !== target._id
          )
          .map((item) => ({ ...item, isActive: false })),
      ],
    };
  });
  agent.setRoute(threadId, { kind: "setup_draft" });
  agent.threads.set(threadId, []);
  client.register(api.setupSessions.getSetupSessionState, (args) =>
    active && (!args.threadId || args.threadId === threadId) ? session : null
  );
  client.register(api.setupSessions.getSetupBootstrapState, () => ({
    activeSession: !active || session.status === "ready" ? null : session,
    suggestedMode: "new_workspace" as const,
    requiresFirstWorkspace: false,
  }));
  client.register(api.setupSessions.ensureSetupSessionWorkflow, () => ({
    scheduled: false,
    recovered: false,
    state: "waiting_for_user" as const,
  }));
  client.register(api.setupSessions.startSetupSession, () => {
    if (!active || session.status === "ready") {
      active = true;
      session.status = "awaiting_input";
      session.generationRevision = 0;
      session.generatedProfiles = [];
      session.hasGeneration = false;
      session.seedDescription = null;
      session.improvedDescription = null;
      session.draftName = null;
      session.generationSourceMessageId = null;
      session.inputMode = null;
      session.targetWorkspaceId = null;
      agent.threads.set(threadId, []);
      agent.setRoute(threadId, { kind: "setup_draft" });
      updateFlow();
    }
    return { sessionId: session.sessionId, threadId, reused: false };
  });
  client.register(
    api.setupSessions.approveSetupGeneration,
    ({ generationRevision }) => {
      if (
        session.status !== "awaiting_icp_confirmation" ||
        generationRevision !== session.generationRevision
      )
        throw new Error("Review the latest examples before continuing.");
      const workspaceId = (
        walkthrough
          ? target._id
          : `demo_workspace_created_${state.workspaces.length}`
      ) as Id<"workspaces">;
      const workspace = {
        ...state.workspaces[0],
        _id: workspaceId,
        name: session.draftName ?? "Contract engineer · payments",
        description: session.seedDescription!,
        improvedDescription: session.improvedDescription!,
        _creationTime: getCurrentUTCTimestamp(),
        setupCompletedAt: getCurrentUTCTimestamp(),
        updatedAt: getCurrentUTCTimestamp(),
        icps: session.generatedProfiles,
        isDefault: true,
      };
      state.workspaces.forEach((item) => {
        item.isDefault = false;
      });
      if (walkthrough) Object.assign(target, workspace);
      else state.workspaces.push(workspace);
      state.selectedWorkspaceId = workspaceId;
      const candidate = createAudienceProspect(
        {
          displayName: "Erin Walsh",
          title: "Contract TypeScript engineer",
          qualificationScore: 95,
          briefIntro:
            "Recently shipped Stripe checkout, subscription webhooks, and idempotent payment handling for a web app. Works on contract projects.",
          signal:
            "Wrapped up a contract rebuilding checkout in TypeScript: Stripe Checkout, webhook retries, and idempotent order creation. The tricky part was making failed payments recoverable without creating duplicate orders.",
        },
        1
      );
      candidate._id = "demo_contract_engineer" as Id<"prospects">;
      candidate.workspaceId = workspaceId;
      candidate.userId = workspace.userId;
      candidate.enrichmentStatus = "enriched";
      candidate._creationTime = getCurrentUTCTimestamp();
      candidate.qualifiedAt = candidate._creationTime;
      candidate.enrichedAt = candidate._creationTime;
      candidate.readyAt = candidate._creationTime;
      if (!walkthrough) state.prospects.push(candidate);
      session.targetWorkspaceId = workspaceId;
      session.status = getNextSetupStatusAfterProvisioning({
        requiresConnections: false,
        requiresPlan: false,
      });
      updateFlow();
      agent.append(
        threadId,
        "user",
        "I approve these audience examples. Continue with setup."
      );
      agent.append(
        threadId,
        "assistant",
        `Your ${workspace.name} workspace is ready. Your accounts are already connected and your plan covers this workspace. Review the ${getWorkspaceUseCase(workspace.useCaseKey).entityPlural} and their evidence before reaching out.`
      );
      agent.setRoute(threadId, { kind: "workspace", workspaceId });
      return {
        success: true as const,
        status: session.status,
        alreadyCompleted: false,
      };
    }
  );
  agent.addResponder(({ threadId: current, prompt, messageId }) => {
    if (active && current === threadId && session.status !== "ready") {
      const corrected = session.generationRevision > 0;
      session.seedDescription ??= prompt;
      session.improvedDescription = `${session.seedDescription}${corrected ? `\n${prompt}` : ""}`;
      session.inputMode = "manual";
      session.draftName = walkthrough
        ? target.name
        : "Contract engineer · payments";
      session.generationRevision += 1;
      session.generationSourceMessageId = messageId;
      session.hasGeneration = true;
      session.status = "awaiting_icp_confirmation";
      session.generatedProfiles = walkthrough
        ? [
            {
              title: target.icps?.[0]?.title ?? target.name,
              description: session.improvedDescription,
              painPoints: target.icps?.[0]?.painPoints ?? [],
              channels: ["twitter", "linkedin"],
              syntheticExamples: audiencePeople
                .filter((person) => person.qualificationStatus === "qualified")
                .slice(0, 2)
                .map((person) => ({
                  platform: person.platform,
                  displayName: person.displayName ?? "",
                  title: person.title ?? "",
                  bio: person.briefIntro ?? "",
                })),
            },
          ]
        : [
            {
              title: "Contract payment engineers",
              description: session.improvedDescription,
              painPoints: ["Reliable checkout and payment recovery"],
              channels: ["twitter", "linkedin"],
              syntheticExamples: [
                {
                  platform: "linkedin",
                  displayName: "Jamie Brooks",
                  title: corrected
                    ? "Contract TypeScript engineer"
                    : "Web payments engineer",
                  bio: corrected
                    ? "Built Stripe checkout and webhook recovery in TypeScript. Takes short contract projects."
                    : "Builds checkout flows for web apps. Has worked with several payment providers.",
                },
                {
                  platform: "twitter",
                  displayName: "Taylor Reed",
                  title: corrected
                    ? "Freelance Stripe developer"
                    : "Full-stack engineer",
                  bio: corrected
                    ? "Shares work on idempotent Stripe webhooks and TypeScript checkout integrations. Works with small teams on contract."
                    : "Shares work on subscriptions, billing screens, and payment APIs.",
                },
              ],
            },
          ];
      updateFlow();
      agent.append(
        current,
        "assistant",
        walkthrough
          ? corrected
            ? "Updated the criteria and examples using your requirements. Review the audience, then continue to start discovery."
            : "I have drafted an audience from your request. Review the examples and tell me any exclusions, constraints, or outreach terms before we start."
          : corrected
            ? "Updated: TypeScript and Stripe are required, and this is a contract project. Review the revised example candidates, then continue if they fit."
            : "I've drafted example candidates for contract work on web payments. Review their experience and tell me what to tighten before continuing."
      );
      return true;
    }
    if (
      !walkthrough &&
      active &&
      session.status === "ready" &&
      /plan|draft|introduction/i.test(prompt)
    ) {
      const person = state.prospects.find(
        (item) => item._id === "demo_contract_engineer"
      )!;
      const { artifact } = createScenarioDraftPlan(state, person, {
        threadId: current,
        description: "Ask about availability for the contract",
        rationale:
          "Erin's recent Stripe checkout and webhook work matches the project. Ask about availability; do not assume it from the profile.",
        content:
          "Hi Erin, I read your post about Stripe webhook retries and avoiding duplicate orders. We're looking for a TypeScript engineer for a six-week checkout project. Your recent contract work looks relevant. Are you open to discussing another contract?",
      });
      agent.append(
        current,
        "assistant",
        "Review this introduction before sending.",
        undefined,
        [
          {
            type: "tool-generatePlan",
            toolCallId: `setup_plan_${messageId}`,
            state: "output-available",
            input: {},
            output: { success: true, artifact },
          },
          { type: "text", text: "Review this introduction before sending." },
        ]
      );
      return true;
    }
    return false;
  });
}
