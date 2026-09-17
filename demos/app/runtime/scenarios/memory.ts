import {
  REACH_OUT_MEMORY_DRAFT,
  REACH_OUT_PREFERENCE,
} from "@/features/blog/lib/reachOutDemoCopy";
import {
  buildDemoIntroduction,
  createScenarioDraftPlan,
} from "../scenarioPlanHelpers";
import { createMemoryArtifact } from "@/shared/lib/json-render/agentArtifacts";
import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import type { registerReportingServices } from "../reportingServices";

export function registerMemoryStory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>,
  reporting: ReturnType<typeof registerReportingServices>
) {
  if (
    state.scenario !== "teach-reacherx-what-you-want" &&
    state.scenario !== "reach-out-writing-preferences"
  )
    return;
  agent.addResponder(({ threadId, prompt, messageId }) => {
    if (/remember|save.*instruction/i.test(prompt)) {
      const instruction = prompt.replace(
        /^Remember this for outreach:\s*/i,
        ""
      );
      const memory = reporting.saveMemory(instruction);
      const text = `Saved for this workspace: ${instruction}`;
      agent.append(threadId, "assistant", text, undefined, [
        {
          type: "tool-rememberWorkspaceMemory",
          toolCallId: `memory_${messageId}`,
          state: "output-available",
          input: { summary: instruction },
          output: {
            success: true,
            memoryId: memory.memoryId,
            artifact: createMemoryArtifact({
              ...memory,
              workspaceId: String(state.selectedWorkspaceId),
            }),
          },
        },
        { type: "text", text },
      ]);
      return true;
    }
    if (!/draft|introduction|plan/i.test(prompt) || !reporting.memories.size)
      return false;
    const person = state.prospects.find(
      (person) =>
        person.workspaceId === state.selectedWorkspaceId &&
        prompt.includes(person.displayName?.split(" ")[0] ?? "\u0000")
    );
    if (!person) return false;
    const workspace = state.workspaces.find(
      (item) => item._id === person.workspaceId
    )!;
    const questionFirst =
      state.scenario === "reach-out-writing-preferences" &&
      [...reporting.memories.values()].some(
        (memory) => memory.summary === REACH_OUT_PREFERENCE
      );
    // This scripted example must not put Nora's wording into another person's plan.
    if (
      state.scenario === "reach-out-writing-preferences" &&
      (!questionFirst || person._id !== "use_case_demo_audience_1")
    )
      return false;
    const { artifact } = createScenarioDraftPlan(state, person, {
      threadId,
      ...buildDemoIntroduction(person, workspace, state.scenario),
      ...(questionFirst ? { content: REACH_OUT_MEMORY_DRAFT } : {}),
      rationale: questionFirst
        ? "Use the saved instruction: open with a question about Nora's work, never with our product. Her post describes approvals scattered across Slack, email, and a PDF."
        : "Use the saved workspace instruction: under 80 words, one question, and no meeting request. Connect it to this person's own work.",
    });
    const text =
      "Here's a first message using the saved instruction. Review it before sending.";
    agent.append(threadId, "assistant", text, undefined, [
      {
        type: "tool-generatePlan",
        toolCallId: `plan_${messageId}`,
        state: "output-available",
        input: {},
        output: { success: true, artifact },
      },
      { type: "text", text },
    ]);
    return true;
  });
}
