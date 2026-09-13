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

import { DEMO_SETUP_THREAD_ID } from "./setupHelpers";

/** A connected, paid demo account uses the same conditional setup gates as the app. */
export function registerSetupStory(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  agent: AgentServices,
  workspaceServices: ReturnType<typeof registerWorkspaceServices>
) {
  if (state.scenario !== "getting-started-with-reacherx") return;
  type Session = NonNullable<
    FunctionReturnType<typeof api.setupSessions.getSetupSessionState>
  >;
  const threadId = DEMO_SETUP_THREAD_ID;
  const session: Session = {
    sessionId: "demo_setup_session" as Id<"workspaceSetupSessions">,
    threadId,
    status: "awaiting_input",
    mode: "new_workspace",
    useCaseKey: "recruiting",
    displayName: "New recruiting workspace",
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
    if (session.status === "ready") return shell;
    return {
      ...shell,
      activeContextType: "setup_session" as const,
      effectiveUseCaseKey: "recruiting" as const,
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
        ...shell.switcherItems.map((item) => ({ ...item, isActive: false })),
      ],
    };
  });
  agent.setRoute(threadId, { kind: "setup_draft" });
  agent.threads.set(threadId, []);
  client.register(api.setupSessions.getSetupSessionState, (args) =>
    !args.threadId || args.threadId === threadId ? session : null
  );
  client.register(api.setupSessions.getSetupBootstrapState, () => ({
    activeSession: session.status === "ready" ? null : session,
    suggestedMode: "new_workspace" as const,
    requiresFirstWorkspace: false,
  }));
  client.register(api.setupSessions.ensureSetupSessionWorkflow, () => ({
    scheduled: false,
    recovered: false,
    state: "waiting_for_user" as const,
  }));
  client.register(api.setupSessions.startSetupSession, () => ({
    sessionId: session.sessionId,
    threadId,
    reused: true,
  }));
  client.register(
    api.setupSessions.approveSetupGeneration,
    ({ generationRevision }) => {
      if (
        session.status !== "awaiting_icp_confirmation" ||
        generationRevision !== session.generationRevision
      )
        throw new Error("Review the latest examples before continuing.");
      const workspaceId = "demo_workspace_contract" as Id<"workspaces">;
      const workspace = {
        ...state.workspaces[0],
        _id: workspaceId,
        name: "Contract engineer · payments",
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
      state.workspaces.push(workspace);
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
      state.prospects.push(candidate);
      session.targetWorkspaceId = workspaceId;
      session.status = getNextSetupStatusAfterProvisioning({
        requiresConnections: false,
        requiresPlan: false,
      });
      updateFlow();
      agent.append(
        threadId,
        "user",
        "I approve these example candidates. Continue with setup."
      );
      agent.append(
        threadId,
        "assistant",
        "Your Contract engineer · payments workspace is ready. Your accounts are already connected and your plan covers this workspace. Review the first candidate's payment experience before reaching out."
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
    if (current === threadId && session.status !== "ready") {
      const corrected = session.generationRevision > 0;
      session.seedDescription ??= prompt;
      session.improvedDescription = `${session.seedDescription}${corrected ? " Required: TypeScript and Stripe checkout experience. A six-week contract, not a permanent role." : ""}`;
      session.inputMode = "manual";
      session.draftName = "Contract engineer · payments";
      session.generationRevision += 1;
      session.generationSourceMessageId = messageId;
      session.hasGeneration = true;
      session.status = "awaiting_icp_confirmation";
      session.generatedProfiles = [
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
        corrected
          ? "Updated: TypeScript and Stripe are required, and this is a contract project. Review the revised example candidates, then continue if they fit."
          : "I've drafted example candidates for contract work on web payments. Review their experience and tell me what to tighten before continuing."
      );
      return true;
    }
    if (session.status === "ready" && /plan|draft|introduction/i.test(prompt)) {
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
