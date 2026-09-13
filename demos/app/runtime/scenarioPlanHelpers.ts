import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { createAppFixtures } from "./appFixtures";
import { getCurrentUTCTimestamp } from "@/shared/lib/utils/time/timeUtils";
import { createPlanPreviewArtifact } from "@/shared/lib/json-render/agentArtifacts";

export function createScenarioDraftPlan(
  state: ReturnType<typeof createAppFixtures>,
  person: Doc<"prospects">,
  input: {
    threadId: string;
    description: string;
    content: string;
    rationale: string;
    media?: { url: string; kind: "image" | "video"; description: string };
  }
) {
  const now = getCurrentUTCTimestamp();
  const planId = `demo_plan_${person._id}` as Id<"outreachPlans">;
  const data = {
    readiness: { requiredPlatforms: [person.platform], missingPlatforms: [] },
    plan: {
      _id: planId,
      _creationTime: now,
      prospectId: person._id,
      workspaceId: person.workspaceId,
      userId: person.userId,
      threadId: input.threadId,
      status: "draft" as const,
      version: 1,
      updatedAt: now,
      strategy: {
        rationale: input.rationale,
        valueProposition: input.description,
        tone: "Helpful and direct",
      },
    },
    tasks: [
      {
        _id: `demo_task_${person._id}` as Id<"outreachTasks">,
        _creationTime: now,
        planId,
        type: "dm" as const,
        order: 1,
        status: "pending" as const,
        timing: { type: "immediate" as const },
        description: input.description,
        content: input.content,
        ...(input.media
          ? {
              mediaUrls: [input.media.url],
              mediaKinds: [input.media.kind],
              mediaDescriptions: [input.media.description],
            }
          : {}),
        approvalReady: false,
        approvalContext: { platform: person.platform },
        originalPost: null,
      },
    ],
  };
  state.plans.set(person._id, data);
  person.planGenerationStatus = "completed";
  return {
    data,
    artifact: createPlanPreviewArtifact({
      planId,
      prospectId: person._id,
      status: "draft",
      rationale: input.rationale,
      tasks: data.tasks,
    }),
  };
}
