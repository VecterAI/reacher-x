import {
  REACH_OUT_BUBBLE_TASKS,
  REACH_OUT_UNICODE_TASKS,
} from "@/features/blog/lib/reachOutDemoCopy";
import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import { createScenarioMessagePlan } from "../scenarioPlanHelpers";

export function registerReachOutStory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>
) {
  if (
    state.scenario !== "reach-out-message-bubbles" &&
    state.scenario !== "reach-out-unicode-formatting"
  )
    return;
  agent.addResponder(({ threadId, prompt, prospectId, messageId }) => {
    const bubbles = state.scenario === "reach-out-message-bubbles";
    if (
      !/draft|plan|introduc/i.test(prompt) ||
      !(bubbles ? /three|3|separate|bubbles/i : /unicode/i).test(prompt)
    )
      return false;
    const person = state.prospects.find(
      (item) => item._id === "use_case_demo_audience_1"
    );
    if (
      !person ||
      person.workspaceId !== state.selectedWorkspaceId ||
      (prospectId ? prospectId !== person._id : !/\bNora\b/i.test(prompt)) ||
      person.status === "archived" ||
      person.qualificationStatus !== "qualified"
    )
      return false;
    const { artifact } = createScenarioMessagePlan(state, person, {
      threadId,
      messages: bubbles ? REACH_OUT_BUBBLE_TASKS : REACH_OUT_UNICODE_TASKS,
      rationale: bubbles
        ? "Start with Nora's post, explain the tool, then ask a question. Send these as three separate messages in that order, with review before each send."
        : "Use one Unicode accent and two short bullets so Nora can scan the message. Keep the rest in ordinary text and connect it to her post about client approvals.",
    });
    const text = bubbles
      ? "I've drafted three separate messages for Nora. Each has its own task, in order. Review the plan, then approve each message for me to send."
      : "I've drafted Nora's message with Unicode bold for one phrase and two short bullets. Review it before I send it; the formatting is part of the text.";
    agent.append(threadId, "assistant", text, undefined, [
      {
        type: "tool-generatePlan",
        toolCallId: `reach_out_${messageId}`,
        state: "output-available",
        input: {},
        output: { success: true, artifact },
      },
      { type: "text", text },
    ]);
    return true;
  });
}
