import {
  createMemoryArtifact,
  createPlanPreviewArtifact,
} from "@/shared/lib/json-render/agentArtifacts";
import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import type { registerReportingServices } from "../reportingServices";

export function registerMemoryStory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>,
  reporting: ReturnType<typeof registerReportingServices>
) {
  if (state.scenario !== "teach-reacherx-what-you-want") return;
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
    const plan = state.plans.get("use_case_demo_candidates_1");
    if (!plan) return false;
    plan.tasks = plan.tasks.slice(0, 1);
    plan.tasks[0].type = "dm";
    plan.tasks[0].description = "Introduce the frontend role";
    plan.tasks[0].content =
      "Hi Isabelle, I read your post about keyboard navigation in complex settings screens. We're a team of three hiring a frontend engineer to improve our web app. The role is remote, €80–100k, within three hours of Paris. Would you like the role details?";
    plan.plan.strategy.rationale =
      "Lead with Isabelle's accessibility work. Keep the introduction under 80 words, with one question and no meeting request.";
    const artifact = createPlanPreviewArtifact({
      planId: plan.plan._id,
      prospectId: plan.plan.prospectId,
      status: plan.plan.status,
      rationale: plan.plan.strategy.rationale,
      tasks: plan.tasks.map((task) => ({
        ...task,
        description: task.description ?? "Review the proposed outreach",
      })),
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
