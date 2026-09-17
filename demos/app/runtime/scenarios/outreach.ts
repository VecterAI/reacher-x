import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import {
  buildDemoIntroduction,
  createScenarioDraftPlan,
} from "../scenarioPlanHelpers";
import { recordDemoActivity } from "../lifecycleHelpers";

export function registerOutreachStory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>
) {
  agent.addResponder(({ threadId, prompt, prospectId, messageId }) => {
    if (
      state.scenario === "create-plans-for-several-people" ||
      !/plan|draft|introduc|reach out/i.test(prompt)
    )
      return false;
    const people = state.prospects.filter(
      (person) => person.workspaceId === state.selectedWorkspaceId
    );
    const person =
      people.find((person) => person._id === prospectId) ??
      people.find((person) =>
        prompt
          .toLowerCase()
          .includes(person.displayName?.toLowerCase() ?? "\u0000")
      ) ??
      people.find(
        (person) =>
          person.status === "new" && person.qualificationStatus === "qualified"
      );
    if (!person) return false;
    if (
      person.status === "archived" ||
      person.qualificationStatus !== "qualified"
    ) {
      agent.append(
        threadId,
        "assistant",
        "This person does not meet the workspace criteria or is archived. Review their status before creating outreach."
      );
      return true;
    }
    const workspace = state.workspaces.find(
      (workspace) => workspace._id === person.workspaceId
    )!;
    const { artifact } = createScenarioDraftPlan(state, person, {
      threadId,
      ...buildDemoIntroduction(person, workspace, state.scenario),
      rationale:
        person.qualificationReasoning ??
        person.briefIntro ??
        "Review the person's recent work before reaching out.",
    });
    recordDemoActivity(
      state.lifecycle,
      person,
      "plan_created",
      "Outreach plan created",
      "A draft introduction is ready for review."
    );
    const text =
      "Review the evidence and proposed message, then approve the plan when you're ready.";
    agent.append(threadId, "assistant", text, undefined, [
      {
        type: "tool-generatePlan",
        toolCallId: `outreach_${messageId}`,
        state: "output-available",
        input: {},
        output: { success: true, artifact },
      },
      { type: "text", text },
    ]);
    return true;
  });
}
