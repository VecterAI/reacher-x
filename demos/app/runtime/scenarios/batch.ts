import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { normalizeAgentMessageContextMetadata } from "@/shared/lib/mentions/messageContext";
import { createPlanBatchProgressArtifact } from "@/shared/lib/json-render/agentArtifacts";
import type { AgentServices, AgentMessage } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import type { LocalClient } from "../LocalClient";
import { createScenarioDraftPlan } from "../scenarioPlanHelpers";
import type { AudienceStory } from "./audiences";

export const batchStory: AudienceStory = {
  useCaseKey: "partnership_outreach",
  workspace: "Partners — client-feedback workshop",
  brief:
    "Invite a small group to a free workshop about handling client feedback. A speaker, a community host, and a guest each need a different invitation.",
  people: [
    {
      displayName: "Maya Shaw",
      title: "Design educator",
      qualificationScore: 94,
      briefIntro:
        "Teaches practical ways to handle conflicting client feedback.",
      signal:
        "My next lesson is about turning contradictory client comments into one clear decision. Designers need a shared language for this.",
    },
    {
      displayName: "Tom Reed",
      title: "Independent designers community host",
      qualificationScore: 90,
      briefIntro:
        "Runs a community whose members ask for help with design reviews.",
      signal:
        "Our members keep asking how to handle revision requests after a project has been approved. Looking for a practical session we can host.",
    },
    {
      displayName: "Lee Park",
      title: "Freelance product designer",
      qualificationScore: 88,
      briefIntro:
        "Recently asked peers for help managing client review rounds.",
      signal:
        "I'd love to compare notes with other freelancers on client feedback. I keep getting new requests after each review round.",
    },
  ],
};
const invitations = [
  "Hi Maya, your lesson on conflicting feedback fits a free workshop we're organising for independent designers. Would you give a ten-minute practical talk? We'll handle hosting and share your work with attendees. No product pitch.",
  "Hi Tom, you mentioned members asking about revision requests after approval. We're hosting a free 30-minute workshop on client feedback. Would you share it with your community? I'll send a short description and registration link so you can decide if it fits.",
  "Hi Lee, I saw your question about feedback arriving after each review round. We're holding a free workshop for independent designers to compare approaches. Would you join the discussion as a guest? No presentation or preparation needed.",
];
type Run = NonNullable<
  FunctionReturnType<typeof api.planBatches.getPlanBatchRun>
>;

export function registerBatchStory(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  agent: AgentServices
) {
  if (state.scenario !== "create-plans-for-several-people") return;
  const runs = new Map<string, Run>();
  client.register(
    api.planBatches.getPlanBatchRun,
    ({ runId }) => runs.get(runId) ?? null
  );
  agent.addResponder(({ threadId, prompt, metadata, messageId }) => {
    const context = normalizeAgentMessageContextMetadata(metadata);
    const ids = new Set(
      context?.taggedEntities
        .filter((entity) => entity.kind === "prospect")
        .map((entity) => entity.prospectId ?? entity.entityId)
    );
    const people = state.prospects.filter(
      (person) =>
        ids.has(person._id) && person.workspaceId === state.selectedWorkspaceId
    );
    if (!people.length || !/plan|retry|try.*again/i.test(prompt)) return false;
    const storyPeople = people.map((person) => ({
      person,
      index: batchStory.people.findIndex(
        (item) => item.displayName === person.displayName
      ),
    }));
    // Unsupported people must not leave a completed run or an empty draft.
    if (storyPeople.some(({ index }) => index < 0)) return false;
    const firstBatch = runs.size === 0;
    if (firstBatch && people.length !== 3) return false;
    const pending = storyPeople.filter(
      ({ person }) => !state.plans.has(person._id)
    );
    const skippedCount = storyPeople.length - pending.length;
    const completed = pending.filter(
      ({ person }) => !(firstBatch && person._id === "use_case_demo_audience_3")
    );
    const failedCount = pending.length - completed.length;
    const runId = `demo_batch_${runs.size + 1}` as Id<"planBatchRuns">;
    const run: Run = {
      _id: runId,
      fitScoreMin: undefined,
      fitScoreMax: undefined,
      operation: "create",
      scopeKind: "tagged",
      status: failedCount ? "partial" : "completed",
      targetCount: people.length,
      eligibleCount: pending.length,
      succeededCount: completed.length,
      createdCount: completed.length,
      updatedCount: 0,
      failedCount,
      skippedCount,
      selectionSkippedCount: 0,
      finishedCount: people.length,
      targetNames: people.map((person) => person.displayName ?? "Person"),
      issues: failedCount
        ? [
            {
              id: "demo_lee_timeout",
              prospectName: "Lee Park",
              reason:
                "The plan generation request timed out. Retry this person.",
            },
          ]
        : [],
    };
    runs.set(runId, run);
    const parts: AgentMessage["parts"] = [
      {
        type: "tool-managePlanBatch",
        toolCallId: `batch_${messageId}`,
        state: "output-available",
        input: {},
        output: {
          success: true,
          artifact: createPlanBatchProgressArtifact({ runId }),
        },
      },
    ];
    for (const { person, index } of completed) {
      const { artifact } = createScenarioDraftPlan(state, person, {
        threadId,
        description: [
          "Invite Maya to give a short talk",
          "Ask Tom to share the workshop",
          "Invite Lee to join as a guest",
        ][index],
        content: invitations[index],
        rationale: `${person.displayName}: ${person.briefIntro} ${index === 0 ? "Ask for a short teaching contribution." : index === 1 ? "Ask him to share it; do not ask him to speak." : "Invite participation, without a speaking obligation."}`,
      });
      parts.push({
        type: "tool-getProspectPlan",
        toolCallId: `plan_${person._id}_${messageId}`,
        state: "output-available",
        input: {},
        output: { success: true, artifact },
      });
    }
    const text = failedCount
      ? "Maya's speaking invitation and Tom's community invitation are ready to review. Lee's plan request timed out; the other two plans are saved. Retry Lee only."
      : "Lee's guest invitation is ready. Maya's and Tom's plans are unchanged. Review the invitations before approving them.";
    parts.push({ type: "text", text });
    agent.append(threadId, "assistant", text, undefined, parts);
    return true;
  });
}
