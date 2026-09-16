import { REACH_OUT_VIDEO_DRAFT } from "@/features/blog/lib/reachOutDemoCopy";
import type { AgentServices } from "../agentServices";
import type { createAppFixtures } from "../appFixtures";
import { createScenarioDraftPlan } from "../scenarioPlanHelpers";
import { normalizeAgentMessageContextMetadata } from "@/shared/lib/mentions/messageContext";
import { MEDIA_INVITATION } from "@/features/blog/lib/conversationDemoCopy";

export function registerMediaStory(
  agent: AgentServices,
  state: ReturnType<typeof createAppFixtures>
) {
  if (
    state.scenario !== "outreach-with-images-and-video" &&
    state.scenario !== "reach-out-personal-video"
  )
    return;
  agent.addResponder(
    ({ threadId, metadata, messageId, prospectId, prompt }) => {
      const context = normalizeAgentMessageContextMetadata(metadata);
      const attachment = context?.attachments.find(
        (item) => item.fileName === "client-feedback.mp4"
      );
      if (!attachment?.mediaUrl) return false;
      const person = state.prospects.find(
        (item) => item._id === "use_case_demo_audience_1"
      );
      if (
        !person ||
        person.workspaceId !== state.selectedWorkspaceId ||
        (prospectId ? prospectId !== person._id : !/\bNora\b/i.test(prompt))
      )
        return false;
      if (
        person.status === "archived" ||
        person.qualificationStatus !== "qualified"
      )
        return false;
      const { artifact } = createScenarioDraftPlan(state, person, {
        threadId,
        description: "Show the client feedback workflow · client-feedback.mp4",
        content:
          state.scenario === "reach-out-personal-video"
            ? REACH_OUT_VIDEO_DRAFT
            : MEDIA_INVITATION,
        rationale:
          "Nora described client feedback scattered across messages. Show only how a client leaves a comment without an account, then ask whether it fits her process.",
        media: {
          url: attachment.mediaUrl,
          kind: "video",
          description:
            "client-feedback.mp4 — A client leaves a comment without creating an account.",
        },
      });
      const text =
        state.scenario === "reach-out-personal-video"
          ? "The clip is attached to Nora's first message. It shows how a client can leave feedback beside a design. Review the message and play the clip before approving."
          : "I've attached client-feedback.mp4 to Nora's proposed message. It shows the exact client-comment step she asked about. Review the message and clip before approving.";
      agent.append(threadId, "assistant", text, undefined, [
        {
          type: "tool-generatePlan",
          toolCallId: `media_${messageId}`,
          state: "output-available",
          input: {},
          output: { success: true, artifact },
        },
        { type: "text", text },
      ]);
      return true;
    }
  );
}
